export type AppStoreLookupResult = {
  trackId?: number;
  version?: string;
  trackViewUrl?: string;
};

// Bound the whole lookup, including response bodies and the fallback storefront.
export async function fetchAppStoreVersion(
  appStoreId: string | undefined,
  bundleId: string,
  signal: AbortSignal,
  timeoutMs = 12_000,
): Promise<AppStoreLookupResult | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new Error('App Store update check cancelled'));
      controller.abort();
    };
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      reject(new Error('App Store update check timed out'));
      controller.abort();
    }, timeoutMs);
  });
  const lookup = async (): Promise<AppStoreLookupResult | null> => {
    const query = appStoreId
      ? `id=${encodeURIComponent(appStoreId)}`
      : `bundleId=${encodeURIComponent(bundleId)}`;
    for (const country of ['it', 'us']) {
      if (controller.signal.aborted) return null;
      const response = await fetch(`https://itunes.apple.com/lookup?${query}&country=${country}`, {
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload = await response.json() as { resultCount?: number; results?: AppStoreLookupResult[] };
      const result = payload.results?.[0];
      if (payload.resultCount && result?.version) return result;
    }
    return null;
  };
  try {
    if (signal.aborted) cancel();
    return await Promise.race([interrupted, lookup()]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
