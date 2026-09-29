import { describe, it, expect } from 'vitest';
import {
  GLYPH_PAINT_VERT_SRC, GLYPH_PATTERN_FRAG_SRC, GLYPH_GRAD_FRAG_SRC, GLYPH_TEXTURE_FRAG_SRC,
  GLYPH_PATTERN_UNIFORMS, GLYPH_GRAD_UNIFORMS, GLYPH_TEXTURE_UNIFORMS, GLYPH_PAINT_ATTRIBUTES,
} from './glyphPaint';
import { BATCH_ATTRIBUTE_LOCATIONS } from './batchFill';

function declaredUniforms(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/gm)) names.add(m[1]);
  return names;
}

/** `layout(location = N) in <type> <name>;` as name → N. */
function pinnedInputs(src: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of src.matchAll(/^\s*layout\(location = (\d+)\)\s*in\s+\w+\s+(\w+)\s*;/gm)) {
    out.set(m[2], Number(m[1]));
  }
  return out;
}

/**
 * A uniform the renderer never looks up keeps its zero default, and one it
 * looks up that no stage declares has no location — either way the paint
 * silently draws wrong, so both lists have to match the sources exactly.
 */
describe.each([
  ['pattern', GLYPH_PATTERN_FRAG_SRC, GLYPH_PATTERN_UNIFORMS],
  ['gradient', GLYPH_GRAD_FRAG_SRC, GLYPH_GRAD_UNIFORMS],
  ['texture', GLYPH_TEXTURE_FRAG_SRC, GLYPH_TEXTURE_UNIFORMS],
] as const)('glyph %s program', (_kind, frag, uniforms) => {
  it('looks up exactly the uniforms its stages declare', () => {
    const declared = new Set([...declaredUniforms(GLYPH_PAINT_VERT_SRC), ...declaredUniforms(frag)]);
    expect([...declared].sort()).toEqual([...uniforms].sort());
  });
});

describe('glyph paint vertex stage', () => {
  it('reads the batch vertex at the batch program\'s own locations', () => {
    const pinned = pinnedInputs(GLYPH_PAINT_VERT_SRC);
    expect([...pinned.keys()].sort()).toEqual([...GLYPH_PAINT_ATTRIBUTES].sort());
    for (const [name, loc] of pinned) {
      expect(loc).toBe(BATCH_ATTRIBUTE_LOCATIONS[name as keyof typeof BATCH_ATTRIBUTE_LOCATIONS]);
    }
  });
});
