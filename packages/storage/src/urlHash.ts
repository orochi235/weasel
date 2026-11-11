/** Encode a string for the URL fragment. A lone surrogate, which the encoding has no form for, is written as
 *  U+FFFD, with a warning. */
export function encodeUrlHash(value: string): string {
  const whole = value.replace(LONE_SURROGATE, '\ufffd');
  if (whole !== value) console.warn('[storage] a URL fragment holds a lone surrogate; it is written as U+FFFD');
  return btoa(encodeURIComponent(whole));
}

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/** Decode a URL fragment written by `encodeUrlHash`, or `null` if it is
 *  malformed. */
export function decodeUrlHash(hash: string): string | null {
  if (!hash) return null;
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
}
