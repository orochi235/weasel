/** Where `clientX` falls along `track`, left to right: `f`, 0 at its left edge and 1 at its right, unclamped, and the
 *  track's drawn `width` in client px. Null with no track, or one with no width. */
export function alongTrack(track: Element | null | undefined, clientX: number): { f: number; width: number } | null {
  const rect = track?.getBoundingClientRect();
  if (!rect || !(rect.width > 0)) return null;
  // eslint-disable-next-line no-restricted-syntax -- a fraction of the drawn width, which an ancestor scale leaves alone.
  return { f: (clientX - rect.left) / rect.width, width: rect.width };
}
