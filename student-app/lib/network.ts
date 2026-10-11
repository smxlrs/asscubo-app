export const NETWORK_TIMEOUT_MS = 20_000;

export type NetworkErrorKey = 'requestErrorTimeout' | 'requestErrorConnection' | 'requestErrorDns'
  | 'requestErrorSecure' | 'requestErrorServer' | 'requestErrorBusy' | 'requestErrorAuth'
  | 'requestErrorForbidden' | 'requestErrorMissing' | 'requestErrorData' | 'requestErrorCancelled'
  | 'requestErrorUnknown';

/** Only classify evidence supplied by the OS/server. Generic fetch failures do not prove DNS failure. */
export function networkErrorKey(error: unknown): NetworkErrorKey {
  const value = error as { message?: string; details?: string; code?: string; name?: string; status?: number; cause?: unknown } | null;
  if (value instanceof NetworkError) return value.reason;
  const text = `${typeof error === 'string' ? error : value?.message || ''} ${value?.details || ''} ${value?.code || ''} ${value?.name || ''}`;
  // Supabase wraps fetch failures in plain objects/strings; carry the safe reason across that boundary.
  const marker = text.match(/\[(requestError(?:Timeout|Connection|Dns|Secure|Server|Busy|Auth|Forbidden|Missing|Data|Cancelled|Unknown))\]/);
  if (marker) return marker[1] as NetworkErrorKey;
  const status = Number(value?.status);
  if (status === 408 || status === 504) return 'requestErrorTimeout';
  if (status === 429) return 'requestErrorBusy';
  if (status >= 500) return 'requestErrorServer';
  if (status === 401 || /PGRST301|PGRST303/.test(text)) return 'requestErrorAuth';
  if (status === 403 || /42501/.test(text)) return 'requestErrorForbidden';
  if (status === 404) return 'requestErrorMissing';
  if (/timeout|timed out|etimedout|超时|逾時/i.test(text)) return 'requestErrorTimeout';
  if (/unknownhost|unable to resolve|enotfound|eai_again|no address associated|cannot find host/i.test(text)) return 'requestErrorDns';
  if (/ssl|tls|certificate|cert_|secure connection/i.test(text)) return 'requestErrorSecure';
  if (/abort|cancel/i.test(text)) return 'requestErrorCancelled';
  if (/network|failed to fetch|fetch failed|connection|econn|无网络|無網路/i.test(text)) return 'requestErrorConnection';
  if (/SyntaxError|json|解析|parse|invalid.*data/i.test(text)) return 'requestErrorData';
  if (value?.cause && value.cause !== error) {
    // Inspect one native cause only, avoiding cycles in arbitrary error objects.
    const cause = value.cause as { message?: string; code?: string };
    return networkErrorKey(`${cause.message || ''} ${cause.code || ''}`);
  }
  return 'requestErrorUnknown';
}

export class NetworkError extends Error {
  public reason: NetworkErrorKey;
  constructor(public kind: 'network' | 'timeout' | 'http' | 'data', message: string,
    public status?: number, public cause?: unknown, reason?: NetworkErrorKey) {
    const classified = reason || (kind === 'timeout' ? 'requestErrorTimeout' : kind === 'data' ? 'requestErrorData'
      : networkErrorKey({ message, status, cause }));
    super(`${message} [${classified}]`);
    this.name = 'NetworkError';
    this.reason = classified;
  }
}

/** Tool APIs use this; Supabase still needs HTTP responses for auth/business error handling. */
export function requireSuccessfulResponse(response: Response): Response {
  if (!response.ok) throw new NetworkError('http', `HTTP ${response.status}`, response.status);
  return response;
}

// Expo 56 fetch returns ArrayBuffers. Its blob() calls RN Blob, which rejects them.
// RN's Response.text() also decodes ArrayBuffers byte-by-byte, corrupting UTF-8.
// Keep original bytes, and decode text explicitly without creating any Blob.
function withUtf8Text(response: Response): Response {
  const readBytes = response.arrayBuffer.bind(response);
  response.text = async () => new TextDecoder('utf-8').decode(await readBytes());
  response.json = async () => JSON.parse(await response.text());
  const clone = response.clone.bind(response);
  response.clone = () => withUtf8Text(clone());
  return response;
}

// Covers headers AND body. A stalled body must not leave a screen loading forever.
export async function fetchWithDeadline(input: RequestInfo | URL, init?: RequestInit, timeoutMs = NETWORK_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const progress: { stage: 'connection' | 'body' } = { stage: 'connection' };
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => { reject(new NetworkError('network', 'Request cancelled', undefined, undefined, 'requestErrorCancelled')); controller.abort(); };
    init?.signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { reject(new NetworkError('timeout', '网络连接超时，请重试')); controller.abort(); }, timeoutMs);
  });
  const request = async () => {
    if (init?.signal?.aborted) { abort(); throw new NetworkError('network', 'Request cancelled', undefined, undefined, 'requestErrorCancelled'); }
    const response = await fetch(input, { ...init, signal: controller.signal });
    progress.stage = 'body';
    const body = await response.arrayBuffer();
    return withUtf8Text(new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    }));
  };
  try { return await Promise.race([interrupted, request()]); }
  catch (error) {
    if (error instanceof NetworkError) throw error;
    const classified = networkErrorKey(error);
    const reason = classified === 'requestErrorUnknown'
      ? (progress.stage === 'body' ? 'requestErrorData' : 'requestErrorConnection') : classified;
    throw new NetworkError(progress.stage === 'body' ? 'data' : 'network', 'Request failed', undefined, error, reason);
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
}
