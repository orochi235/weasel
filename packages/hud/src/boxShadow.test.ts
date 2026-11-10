import type { Path } from '@weasel-js/geom';
import { pointInPath } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { boxShadowCommands } from './boxShadow';

const box = { x: 0, y: 0, w: 10, h: 10 };
const shadow = (spread: number) => ({ inset: true, x: 0, y: 0, blur: 0, spread, color: 'black' });

/** The inset layer's ring, the region it paints before the box clips it. */
function ring(spread: number): Path {
  const [group] = boxShadowCommands(box, 0, [shadow(spread)], 'black').over;
  const child = (group as { children: { path: Path }[] }).children[0]!;
  return child.path;
}

describe('an inset box-shadow', () => {
  it('leaves the box less its spread unshadowed', () => {
    const path = ring(2);
    expect(pointInPath(path, 1, 5)).toBe(true);
    expect(pointInPath(path, 5, 5)).toBe(false);
  });

  it('fills the whole box when its spread reaches past the middle', () => {
    // 6px in from each side of a 10px box leaves no inner box at all, as CSS draws it.
    const path = ring(6);
    for (const x of [1, 4.5, 5, 5.5, 9]) expect(pointInPath(path, x, 5)).toBe(true);
  });
});
