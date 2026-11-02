/**
 * A text node's stroke ignores `trim`: per-glyph outlines have no single pen
 * order to draw them on in.
 */
import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import type { LaidOutGroup } from '@weasel-js/text';
import { mat3 } from '@weasel-js/geom';
import { outlineGroupStrokeMesh } from './glyphOutlineMesh';
import { _resetOutlineStrokeMeshCacheForTests } from './cache/outlineStrokeMeshCache';

const STROKE: Stroke = { paint: { kind: 'solid', color: '#000' }, width: 2 };

function group(stroke: Stroke): LaidOutGroup {
  const glyph = { key: 'sq', d: 'M0 0L1 0L1 -1L0 -1Z', scale: 40, x: 10, baselineY: 50, rotate: 0 };
  return { stroke, glyphs: [glyph], synthetic: { italic: false } } as unknown as LaidOutGroup;
}

function mesh(stroke: Stroke) {
  _resetOutlineStrokeMeshCacheForTests();
  const m = outlineGroupStrokeMesh(group(stroke), 0, 0, mat3.identity())!;
  return { vertices: Array.from(m.vertices), indices: Array.from(m.indices) };
}

describe('outlined text — trim', () => {
  it('a text node with stroke.trim draws the same mesh as without', () => {
    const whole = mesh(STROKE);
    expect(whole.indices.length).toBeGreaterThan(0);
    expect(mesh({ ...STROKE, trim: { end: 0.3 } })).toEqual(whole);
    expect(mesh({ ...STROKE, width: { px: 2 }, trim: { start: 0.5, end: 0.6 } }))
      .toEqual(mesh({ ...STROKE, width: { px: 2 } }));
  });
});
