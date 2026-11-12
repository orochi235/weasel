/** Writes `text` to the system clipboard; answers whether it took it. A page served without a secure context has
 *  no clipboard, and the browser may refuse the write (no user gesture, a denied permission): both answer false
 *  rather than throw or reject. */
export function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard?.writeText) return Promise.resolve(false);
  try {
    return clipboard.writeText(text).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}
