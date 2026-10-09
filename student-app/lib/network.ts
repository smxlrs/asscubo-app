export class NetworkError extends Error {
  constructor(public kind: 'network' | 'timeout' | 'http' | 'data', message: string) { super(message); }
}

// Covers headers AND body. A stalled body must not leave a screen loading forever.
export async function fetchWithDeadline(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => { reject(new NetworkError('network', '请求已取消')); controller.abort(); };
    init?.signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { reject(new NetworkError('timeout', '网络连接超时，请重试')); controller.abort(); }, timeoutMs);
  });
  const request = async () => {
    if (init?.signal?.aborted) { abort(); throw new NetworkError('network', '请求已取消'); }
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Keep a Blob so React Native decodes text as UTF-8, rather than mapping each byte to a character.
    const body = await response.blob();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  };
  try { return await Promise.race([interrupted, request()]); }
  catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError('network', '无网络，请检查网络连接');
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
}
