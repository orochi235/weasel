import { describe, expect, it } from 'vitest';
import { cursorFor } from '@weasel-js/cursor';

/**
 * jsdom has no cursor, so nothing here can prove anything rendered. These
 * assert the string the tool hands the host, which is the last thing on this
 * side of the boundary that is ours to get right.
 */
describe('builtin tool cursors', () => {
  it('gives the pencil tool a pencil, falling back to crosshair', () => {
    const css = cursorFor('pencil', { fallback: 'crosshair' });
    expect(css).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(css).toMatch(/, crosshair$/);
  });

  it('keeps a keyword available for the pen tool while it hints a close', () => {
    // usePenTool swaps to 'pointer' when closing the subpath is the next click;
    // that hint is about routing, not about the tool, so it stays a keyword.
    expect(cursorFor('pen', { fallback: 'crosshair' })).not.toBe('pointer');
  });

  it('declares a hotspot on every tool cursor', () => {
    // A cursor with no hotspot silently acts from its top-left corner.
    for (const name of ['pencil', 'pen', 'eyedropper'] as const) {
      expect(cursorFor(name)).toMatch(/"\) \d+ \d+, /);
    }
  });
});
