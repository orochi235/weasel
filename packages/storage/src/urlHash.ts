/** Encode a string for the URL fragment. */
export function encodeUrlHash(value: string): string {
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
