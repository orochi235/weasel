import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { unmetGates } from './unmetGates';

const withC = (over: Partial<Constraints>): Constraints => ({ ...DEFAULT_CONSTRAINTS, ...over });
const anchor = (hue: number): Anchor => ({ name: `h${hue}`, hue, lightness: 0.7 });

describe('unmetGates', () => {
  it('names the pins, not the gates, when anchors outnumber the colors asked for', () => {
    const c = withC({ count: 5, anchors: [0, 50, 100, 150, 200, 250, 300].map(anchor) });
    const palette = generate(c);
    expect(palette.feasible).toBe(false);
    expect(unmetGates(c, palette.stats)).toEqual(['7 colors are pinned for 5: add 2 more colors or unpin 2']);
  });
});
