/** Encode a string for the URL fragment. A lone surrogate, which the encoding has no form for, is written as
 *  U+FFFD, with a warning. */
export function encodeUrlHash(value: string): string {
  if (!value.isWellFormed()) {
    console.warn('[storage] a URL fragment holds a lone surrogate; it is written as U+FFFD');
    return btoa(encodeURIComponent(value.toWellFormed()));
  }
  return btoa(encodeURIComponent(value));
}

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
