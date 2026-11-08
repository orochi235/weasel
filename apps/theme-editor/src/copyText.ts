/** Writes `text` to the clipboard; answers whether it took it. A refusal or a missing clipboard answers false. */
export function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) return Promise.resolve(false);
  return clipboard.writeText(text).then(() => true, () => false);
}
