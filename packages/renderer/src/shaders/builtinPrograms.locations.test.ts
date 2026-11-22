import { describe, it, expect } from 'vitest';
import { BATCH_FILL_MATRICES_SPEC, GLYPH_LAYER_SPECS, type ProgramSpec } from './builtinPrograms';

/** `layout(location = N) in <type> <name>;` in `src`, as name → N. */
function declaredLocations(src: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of src.matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*in\s+\w+\s+(\w+)\s*;/g)) out[m[2]] = Number(m[1]);
  return out;
}

describe('a built-in program answering attribute locations before its link', () => {
  const specs: [string, ProgramSpec][] = [
    ['batch', BATCH_FILL_MATRICES_SPEC], ['glyph layer', GLYPH_LAYER_SPECS[0]], ['glyph layer, area', GLYPH_LAYER_SPECS[1]],
  ];
  it.each(specs)('%s gives the locations its vertex stage declares', (_name, spec) => {
    expect(spec.locations).toEqual(declaredLocations(spec.vert));
  });
});
