import { describe, expect, it } from 'vitest';
import { ICON_STROKE } from '@weasel-js/icons';
// @ts-expect-error -- a plain .mjs glyph module, no declarations
import { ACTIONS } from '../icons/actions.mjs';

/** The box a glyph's strokes ink, from its absolute M/H/V/L/Z path data and each path's stroke width and cap. */
function inkBox(body: string) {
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const [, attrs] of body.matchAll(/<path([^>]*)\/>/g)) {
    const d = /\bd="([^"]*)"/.exec(attrs)![1];
    const w = Number(/stroke-width="([^"]*)"/.exec(attrs)?.[1] ?? ICON_STROKE) / 2;
    const butt = attrs.includes('stroke-linecap="butt"');
    let x = 0;
    let y = 0;
    let start = [0, 0];
    const run = (x1: number, y1: number) => {
      // A butt cap stops at its endpoint along the run; a round cap or a mitred right angle inks half a stroke
      // past it. Across the run, every stroke inks half its width either side.
      const ax = butt && y1 === y ? 0 : w;
      const ay = butt && x1 === x ? 0 : w;
      box.left = Math.min(box.left, x - ax, x1 - ax);
      box.right = Math.max(box.right, x + ax, x1 + ax);
      box.top = Math.min(box.top, y - ay, y1 - ay);
      box.bottom = Math.max(box.bottom, y + ay, y1 + ay);
      [x, y] = [x1, y1];
    };
    for (const [, cmd, args] of d.matchAll(/([MHVLZ])([^MHVLZ]*)/g)) {
      const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === 'M') [x, y] = start = [v[0], v[1]];
      else if (cmd === 'H') run(v[0], y);
      else if (cmd === 'V') run(x, v[0]);
      else if (cmd === 'L') run(v[0], v[1]);
      else run(start[0], start[1]);
    }
  }
  return box;
}

describe("WeaselChart's action glyphs", () => {
  it.each(Object.entries(ACTIONS as Record<string, string>))('%s inks inside the 20×20 viewBox', (_, body) => {
    const box = inkBox(body);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(20);
    expect(box.bottom).toBeLessThanOrEqual(20);
  });
});
