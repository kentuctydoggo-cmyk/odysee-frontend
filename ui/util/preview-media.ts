// Base44 sandbox only.
//
// `player.odycdn.com` / `secure.odycdn.com` hotlink-protect by Referer: a request
// coming from the preview hostname is answered with 401, so no video or audio
// would load. When BASE44_PREVIEW_MODE === '1' those URLs are routed through the
// dev server's `/__b44` proxy (see `server.proxy` in vite.config.ts), which sends
// an odysee.com Referer.
//
// With the flag unset (or any other value) every URL is returned untouched.
const PREVIEW_PROXY_PREFIX = '/__b44';
const PROXIED_MEDIA_HOSTS = ['player.odycdn.com', 'secure.odycdn.com'];

export const isPreviewMode = (): boolean => process.env.BASE44_PREVIEW_MODE === '1';

export function rewritePreviewMediaUrl(url: string): string {
  if (!isPreviewMode() || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (!PROXIED_MEDIA_HOSTS.includes(parsed.hostname)) {
      return url;
    }

    return `${PREVIEW_PROXY_PREFIX}/${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

// The daemon returns stream sources as `streaming_url` (top-level for `get`,
// per-item for `file_list`). Rewrite them wherever they appear in the result.
export function rewritePreviewMediaUrls<T>(value: T, depth = 0): T {
  if (!isPreviewMode() || !value || typeof value !== 'object' || depth > 3) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewritePreviewMediaUrls(item, depth + 1)) as unknown as T;
  }

  const record = value as Record<string, any>;

  if (typeof record.streaming_url === 'string') {
    record.streaming_url = rewritePreviewMediaUrl(record.streaming_url);
  }

  Object.keys(record).forEach((key) => {
    const child = record[key];
    if (child && typeof child === 'object') {
      record[key] = rewritePreviewMediaUrls(child, depth + 1);
    }
  });

  return value;
}
