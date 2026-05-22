/** Apple-style glyph for a DOM `KeyboardEvent.key` value. Covers escape,
 *  delete/backspace, arrows, enter/return, tab, space. Unknown keys are
 *  upper-cased (so `'a'` reads as `A` on a keycap) and returned unchanged
 *  otherwise — making this safe to apply uniformly without a `has-glyph`
 *  check at the call site. */
export function keyGlyph(rawKey: string): string {
  switch (rawKey) {
    case 'Escape': return '⎋';
    case 'Backspace': return '⌫';
    case 'Delete': return '⌦';
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'Enter':
    case 'Return': return '↵';
    case 'Tab': return '⇥';
    case ' ':
    case 'Space': return '␣';
    default: return rawKey.toUpperCase();
  }
}
