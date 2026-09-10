import { describe, it, expect } from 'vitest';
import {
  BATCH_VERT_SRC, BATCH_FRAG_SRC, BATCH_FILL_UNIFORMS, BATCH_FILL_ATTRIBUTES,
  BATCH_TEXTURE_SLOTS, WHITE_SLOT, PAINT_MODE_PLAIN,
} from './batchFill';
import { FLOATS_PER_VERTEX } from '../drawBatch';

/** Names declared as `uniform <type> <name>;`, array suffix trimmed. */
function declaredUniforms(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/gm)) names.add(m[1]);
  return names;
}

/** Names declared as `in <type> <name>;` in a vertex shader. */
function declaredInputs(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*in\s+\w+\s+(\w+)\s*;/gm)) names.add(m[1]);
  return names;
}

/**
 * The declaration lists have to match the sources.
 *
 * A name the renderer looks up that no stage declares yields a null location,
 * and whatever the CPU sets against it goes nowhere — silently, with the draw
 * still issuing. This is the invariant that caught a uniform left behind after
 * the AA width stopped being one.
 */
describe('batch program — declaration lists match the sources', () => {
  const declared = new Set<string>([
    ...declaredUniforms(BATCH_VERT_SRC),
    ...declaredUniforms(BATCH_FRAG_SRC),
  ]);

  it.each(BATCH_FILL_UNIFORMS)('%s is declared in at least one stage', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('lists every uniform the stages declare', () => {
    expect([...declared].sort()).toEqual([...BATCH_FILL_UNIFORMS].sort());
  });

  it.each(BATCH_FILL_ATTRIBUTES)('%s is declared as a vertex input', (name) => {
    expect(declaredInputs(BATCH_VERT_SRC).has(name)).toBe(true);
  });

  it('lists every vertex input the stage declares', () => {
    expect([...declaredInputs(BATCH_VERT_SRC)].sort()).toEqual([...BATCH_FILL_ATTRIBUTES].sort());
  });

  /** Every attribute is one float or one vector, and they pack the vertex. */
  it('accounts for every float in the vertex', () => {
    const widths: Record<string, number> = { vec2: 2, vec3: 3, vec4: 4, float: 1 };
    let floats = 0;
    for (const m of BATCH_VERT_SRC.matchAll(/^\s*in\s+(\w+)\s+\w+\s*;/gm)) floats += widths[m[1]] ?? 0;
    expect(floats).toBe(FLOATS_PER_VERTEX);
  });
});

describe('batch program — the sampler chain', () => {
  it('unrolls one arm per slot past the white texel', () => {
    // GLSL ES 3.0 will not index a sampler array with a variable, so the arms
    // over constants are the only legal form — and there must be exactly
    // enough of them, or the last slots silently fall through to white.
    const arms = [...BATCH_FRAG_SRC.matchAll(/if \(slot == (\d+)\)/g)].map((m) => Number(m[1]));
    expect(arms).toEqual(
      Array.from({ length: BATCH_TEXTURE_SLOTS - 1 }, (_, i) => i + 1),
    );
  });

  it('falls through to the white texel, which is the slot solids carry', () => {
    expect(BATCH_FRAG_SRC).toMatch(/return texture\(u_samplers\[0\], uv\);/);
    expect(WHITE_SLOT).toBe(0);
  });
});

describe('batch program — glyph coverage is unconditional', () => {
  /**
   * The one thing that cannot be checked by reading `GLYPH_COVERAGE_GLSL`
   * alone: that the *caller* runs it on every fragment. `fwidth` inside
   * non-uniform control flow is undefined, so a branch here would compile,
   * pass, and produce driver-dependent glyph edges.
   */
  it('calls glyphCoverage outside any conditional', () => {
    const body = BATCH_FRAG_SRC.slice(BATCH_FRAG_SRC.indexOf('void main()'));
    const call = body.indexOf('glyphCoverage(');
    expect(call).toBeGreaterThan(0);
    expect(body.slice(0, call)).not.toMatch(/\bif\s*\(|\bfor\s*\(|\bwhile\s*\(/);
  });

  it('discards that coverage on a fragment that is not a glyph', () => {
    // Paint mode 0 must come out with the coverage multiplied away entirely,
    // or every solid rect in the run gets antialiased against a field it has
    // no business sampling.
    expect(PAINT_MODE_PLAIN).toBe(0);
    expect(BATCH_FRAG_SRC).toMatch(/isGlyph\s*=\s*step\(0\.5,\s*v_paintMode\)/);
    expect(BATCH_FRAG_SRC).toMatch(/mix\(1\.0,\s*coverage,\s*isGlyph\)/);
  });

  it('keeps a glyph texel out of the color', () => {
    // The texel is a distance field there, not a color — multiplying it in
    // would paint every glyph in its own coverage as well as fading it.
    expect(BATCH_FRAG_SRC).toMatch(/mix\(texel,\s*vec4\(1\.0\),\s*isGlyph\)/);
  });
});
