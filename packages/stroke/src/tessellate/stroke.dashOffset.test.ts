import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';
import { strokeAtScale } from '../strokeAtScale';

const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();

/** The x extents of each dash a butt-capped horizontal ribbon draws, left to right. */
function dashes(stroke: Partial<Stroke>, path = LINE): [number, number][] {
  const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 2, cap: 'butt', ...stroke });
  const xs = new Set<number>();
  for (let i = 0; i < mesh.vertices.length; i += 2) xs.add(Math.round(mesh.vertices[i]! * 1000) / 1000);
  const sorted = [...xs].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) out.push([sorted[i]!, sorted[i + 1]!]);
  return out;
}

describe('a stroke dash offset', () => {
  it('starts the pattern that far in', () => {
    expect(dashes({ dash: [10, 10], dashOffset: 5 }).slice(0, 2)).toEqual([[0, 5], [15, 25]]);
  });

  it('starts it before the beginning when negative', () => {
    expect(dashes({ dash: [10, 10], dashOffset: -5 }).slice(0, 2)).toEqual([[5, 15], [25, 35]]);
  });

  it('wraps an odd pattern over twice its sum', () => {
    expect(dashes({ dash: [10], dashOffset: 30 }).slice(0, 1)).toEqual([[10, 20]]);
  });

  it('reads a non-finite offset as none', () => {
    expect(dashes({ dash: [10, 10], dashOffset: NaN })).toEqual(dashes({ dash: [10, 10] }));
  });

  it('moves with a trimmed window, which starts mid-pattern', () => {
    // The window starts at 30, 3 into the pattern [10, 10] shifted by 5: the dash at 35 is cut to 35–45.
    const drawn = dashes({ dash: [10, 10], dashOffset: 5, trim: { start: 0.3, end: 1 } });
    expect(drawn[0]).toEqual([35, 45]);
  });

  it('resolves with the dash on a screen-pixel width', () => {
    expect(strokeAtScale({ width: { px: 2 }, dash: [4, 4], dashOffset: 2 }, 2)).toMatchObject({ dash: [2, 2], dashOffset: 1 });
  });
});
