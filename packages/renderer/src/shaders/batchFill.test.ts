import { describe, it, expect } from 'vitest';
import {
  BATCH_VERT_SRC, BATCH_FRAG_SRC, BATCH_MATRICES_FRAG_SRC, BATCH_FILL_UNIFORMS, BATCH_FILL_ATTRIBUTES,
  BATCH_TEXTURE_SLOTS, BATCH_MATRIX_SLOTS, WHITE_SLOT, RAMP_SLOT, PAINT_MODE_PLAIN, PAINT_MODE_RADIAL,
  PAINT_MODE_CONIC, PAINT_MODE_IMAGE, packSlot, withMatrix, withHull, paintModeOf, matrixOf, hullOf,
} from './batchFill';
import { FLOATS_PER_VERTEX } from '../drawBatch';
import { HULL_PLANES, HULL_POOL } from '../batchHull';

/** Names declared as `uniform <type> <name>;`, array suffix trimmed. */
function declaredUniforms(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/gm)) names.add(m[1]);
  return names;
}

/** Names declared as `in <type> <name>;` in a vertex shader. */
function declaredInputs(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*(?:layout\([^)]*\)\s*)?in\s+\w+\s+(\w+)\s*;/gm)) names.add(m[1]);
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

  it('lists every uniform the stages declare', () => {
    expect([...declared].sort()).toEqual([...BATCH_FILL_UNIFORMS].sort());
  });

  it('lists every vertex input the stage declares', () => {
    expect([...declaredInputs(BATCH_VERT_SRC)].sort()).toEqual([...BATCH_FILL_ATTRIBUTES].sort());
  });

  /** Every attribute is one float or one vector, and they pack the vertex. */
  it('accounts for every float in the vertex', () => {
    const widths: Record<string, number> = { vec2: 2, vec3: 3, vec4: 4, float: 1 };
    let floats = 0;
    for (const m of BATCH_VERT_SRC.matchAll(/^\s*(?:layout\([^)]*\)\s*)?in\s+(\w+)\s+\w+\s*;/gm)) floats += widths[m[1]] ?? 0;
    expect(floats).toBe(FLOATS_PER_VERTEX);
  });
});

describe('batch program — the sampler tree', () => {
  /** `sampleSlot`'s body with each fetch replaced by the unit it reads, so the
   *  branching can be run here. */
  const body = BATCH_FRAG_SRC.slice(
    BATCH_FRAG_SRC.indexOf('vec4 sampleSlot(int slot, vec2 uv) {') + 'vec4 sampleSlot(int slot, vec2 uv) {'.length,
    BATCH_FRAG_SRC.indexOf('float median('),
  );
  const unitFor = new Function(
    'slot', body.replace(/texture\(u_samplers\[(\d+)\], uv\)/g, '$1').replace(/\}\s*$/, ''),
  ) as (slot: number) => number;

  it('samples the unit each slot names', () => {
    // GLSL ES 3.0 will not index a sampler array with a variable, so a fetch
    // per constant is the only legal form, and a slot whose arm is missing or
    // crossed samples somebody else's texture.
    expect(BATCH_TEXTURE_SLOTS).toBe(16);
    const fetches = [...body.matchAll(/texture\(u_samplers\[(\d+)\], uv\)/g)].map((m) => Number(m[1]));
    expect(fetches.slice(0, BATCH_TEXTURE_SLOTS)).toEqual(Array.from({ length: BATCH_TEXTURE_SLOTS }, (_, i) => i));
    for (let slot = 0; slot < BATCH_TEXTURE_SLOTS; slot++) expect(unitFor(slot)).toBe(slot);
  });

  it('reaches any slot in four compares, the white texel included', () => {
    let depth = 0;
    let deepest = 0;
    for (const ch of body) {
      if (ch === '{') deepest = Math.max(deepest, ++depth);
      else if (ch === '}') depth--;
    }
    expect(deepest).toBe(Math.log2(BATCH_TEXTURE_SLOTS));
    expect(WHITE_SLOT).toBe(0);
  });

  it('fetches a radial or conic ramp from the ramp slot, so the tree is written once', () => {
    // A second copy of the tree in the gradient arm took a software
    // rasterizer longer to build than the rest of the program.
    expect(RAMP_SLOT).toBe(BATCH_TEXTURE_SLOTS - 1);
    expect(BATCH_FRAG_SRC).toContain(`texture(u_samplers[${RAMP_SLOT}], vec2(t, v_post))`);
    expect([...BATCH_FRAG_SRC.matchAll(/texture\(/g)]).toHaveLength(BATCH_TEXTURE_SLOTS + 1);
    expect([...BATCH_FRAG_SRC.matchAll(/sampleSlot\(v_texSlot/g)]).toHaveLength(1);
  });
});

describe('batch program — slot, mode, matrix and hull share a float', () => {
  it('unpacks in the vertex stage what packSlot, withMatrix and withHull packed', () => {
    // The divisors as the shader source spells them, so a constant that moved
    // on one side only fails here.
    const slotMod = Number(/v_texSlot = packed % (\d+);/.exec(BATCH_VERT_SRC)![1]);
    const mode = /v_paintMode = float\(\(packed \/ (\d+)\) % (\d+)\);/.exec(BATCH_VERT_SRC)!;
    const matrix = /v_matrix = \(packed \/ (\d+)\) % (\d+);/.exec(BATCH_VERT_SRC)!;
    const hullDiv = Number(/int hull = packed \/ (\d+);/.exec(BATCH_VERT_SRC)![1]);
    const start = /v_hullStart = hull == 0 \? 0 : \(hull - 1\) \/ (\d+);/.exec(BATCH_VERT_SRC)!;
    const hulls: [number, number][] = [[0, 0], [0, 1], [3, 4], [HULL_POOL - 1, 1], [HULL_POOL - HULL_PLANES, HULL_PLANES]];
    for (let slot = 0; slot < BATCH_TEXTURE_SLOTS; slot++) {
      for (let m = PAINT_MODE_PLAIN; m <= PAINT_MODE_IMAGE; m++) {
        for (let mx = 0; mx < BATCH_MATRIX_SLOTS; mx++) {
          for (const [first, count] of hulls) {
            const base = withMatrix(slot, mx);
            const packed = packSlot(count === 0 ? base : withHull(base, first, count), m);
            expect(Math.fround(packed)).toBe(packed);
            const h = Math.floor(packed / hullDiv);
            expect([
              packed % slotMod,
              Math.floor(packed / Number(mode[1])) % Number(mode[2]),
              Math.floor(packed / Number(matrix[1])) % Number(matrix[2]),
              h === 0 ? 0 : Math.floor((h - 1) / Number(start[1])),
            ]).toEqual([slot, m, mx, first]);
            expect([paintModeOf(packed), matrixOf(packed), hullOf(packed)]).toEqual([m, mx, [first, count]]);
          }
        }
      }
    }
  });

  it('maps each fragment by the matrix its vertex names', () => {
    expect(BATCH_MATRICES_FRAG_SRC).toContain(`uniform mat4 u_colorMatrix[${BATCH_MATRIX_SLOTS}];`);
    expect(BATCH_MATRICES_FRAG_SRC).toContain(`uniform vec4 u_colorBias[${BATCH_MATRIX_SLOTS}];`);
    expect(BATCH_MATRICES_FRAG_SRC).toContain(`uniform float u_alpha[${BATCH_MATRIX_SLOTS}];`);
    expect(BATCH_MATRICES_FRAG_SRC).toMatch(/u_colorMatrix\[v_matrix\] \* src \+ u_colorBias\[v_matrix\]/);
    expect(BATCH_MATRICES_FRAG_SRC).toMatch(/mapped\.a \* u_alpha\[v_matrix\]/);
  });

  it('maps a run under one matrix by entry 0, with the same arithmetic', () => {
    expect(BATCH_FRAG_SRC).toContain('uniform mat4 u_colorMatrix[1];');
    expect(BATCH_FRAG_SRC).not.toContain('[v_matrix]');
    // Nothing else differs, so a run draws the same pixels under either.
    const one = BATCH_MATRICES_FRAG_SRC
      .replace(/(u_colorMatrix|u_colorBias|u_alpha)\[\d+\];/g, '$1[1];')
      .replace(/\[v_matrix\]/g, '[0]');
    expect(BATCH_FRAG_SRC).toBe(one);
  });
});

describe('batch program — glyph coverage is unconditional', () => {
  /**
   * The one thing that cannot be checked by reading `GLYPH_COVERAGE_GLSL`
   * alone: that the *caller* runs it on every fragment. `fwidth` inside
   * non-uniform control flow is undefined, so a branch around it would compile,
   * pass, and produce driver-dependent glyph edges.
   *
   * Depth, not "no `if` appears earlier in the text": the gradient uv selection
   * *is* a branch, and a legal one — it computes no derivative, and what
   * matters is only that this call is not inside it.
   */
  it('calls glyphCoverage at the top level of main', () => {
    const body = BATCH_FRAG_SRC.slice(BATCH_FRAG_SRC.indexOf('void main()'));
    const call = body.indexOf('glyphCoverage(');
    expect(call).toBeGreaterThan(0);
    let depth = 0;
    for (let i = 0; i < call; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
    }
    expect(depth, 'glyphCoverage is nested inside a block').toBe(1);
  });

  /** The other half of the same rule: nothing the shader branches on may
   *  contain a derivative, whatever the reason for the branch. */
  it('takes no derivative inside a conditional', () => {
    const body = BATCH_FRAG_SRC.slice(BATCH_FRAG_SRC.indexOf('void main()'));
    let depth = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
      else if (depth > 1 && /^(fwidth|dFdx|dFdy)\s*\(/.test(body.slice(i))) {
        throw new Error(`derivative inside a block: ${body.slice(i, i + 40)}`);
      }
    }
    expect(depth).toBe(0);
  });

  it('discards that coverage on a fragment that is not a glyph', () => {
    // Paint mode 0 must come out with the coverage multiplied away entirely,
    // or every solid rect in the run gets antialiased against a field it has
    // no business sampling.
    expect(PAINT_MODE_PLAIN).toBe(0);
    expect(BATCH_FRAG_SRC).toMatch(/isGlyph\s*=\s*step\(0\.5,\s*v_paintMode\)/);
    expect(BATCH_FRAG_SRC).toMatch(/mix\(1\.0,\s*coverage,\s*isGlyph\)/);
  });

  it('excludes the gradient modes, which sit above the glyph ones', () => {
    // `step(0.5, mode)` alone would call a radial gradient a glyph, paint it in
    // the coverage of a distance field it never sampled, and throw its color
    // away for `vec4(1.0)`. The upper bound is what stops that.
    expect(PAINT_MODE_RADIAL).toBeGreaterThan(2);
    expect(PAINT_MODE_CONIC).toBeGreaterThan(2);
    expect(BATCH_FRAG_SRC).toMatch(
      /isGlyph\s*=\s*step\(0\.5,\s*v_paintMode\)\s*\*\s*step\(v_paintMode,\s*2\.5\)/,
    );
  });

  it('reads a glyph\'s bold shift from a_post, and keeps it out of the alpha', () => {
    // A glyph's a_post is 0 or a small shift: read as the alpha factor it is on
    // every other vertex, it would erase the text.
    expect(BATCH_FRAG_SRC).not.toContain('u_synthBold');
    expect(BATCH_FRAG_SRC).toMatch(/glyphCoverage\(texel,\s*v_paintMode,\s*v_post \* isGlyph,/);
    expect(BATCH_FRAG_SRC).toMatch(/mix\(v_post,\s*1\.0,\s*max\(isGrad,\s*isGlyph\)\)/);
  });

  it('keeps a glyph texel out of the color', () => {
    // The texel is a distance field there, not a color — multiplying it in
    // would paint every glyph in its own coverage as well as fading it.
    expect(BATCH_FRAG_SRC).toMatch(/mix\(texel,\s*vec4\(1\.0\),\s*isGlyph\)/);
  });
});
