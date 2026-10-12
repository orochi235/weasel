/**
 * What a key press on a thumb asks for: a count of key steps (an arrow is one,
 * shift or a Page key ten, negative toward `min`), an end of the track, or
 * `null` for a key the slider leaves alone.
 */
export function keyMoveOf(e: { key: string; shiftKey: boolean }): number | 'home' | 'end' | null {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return e.shiftKey ? 10 : 1;
    case 'ArrowLeft':
    case 'ArrowDown':
      return e.shiftKey ? -10 : -1;
    case 'PageUp':
      return 10;
    case 'PageDown':
      return -10;
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    default:
      return null;
  }
}
