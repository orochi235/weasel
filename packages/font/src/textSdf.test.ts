import { describe, it, expect } from 'vitest';
import {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './textSdf';

/**
 * These are source-level assertions because the shaders' actual behavior needs
 * a GL context and a rasterizer to observe. The end-to-end guard is
 * `tests/visual/text-aa.spec.ts`, which renders in real Chrome and measures the
 * edge-coverage histogram; this file is the cheap unit-tier tripwire that fires
 * in `vitest` the moment someone reintroduces a constant AA width.
 */

const FRAG_SHADERS: ReadonlyArray<readonly [string, string]> = [
  ['TEXT_FRAG_SRC (MSDF)', TEXT_FRAG_SRC],
  ['TEXT_FRAG_R8_SRC (dynamic canvas SDF)', TEXT_FRAG_R8_SRC],
];

/** Names declared as `uniform <type> <name>;` in a GLSL source. */
function declaredUniforms(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)) names.add(m[1]);
  return names;
}

/** Names declared as `in <type> <name>;` in a vertex shader. */
function declaredInputs(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s*in\s+\w+\s+(\w+)\s*;/gm)) names.add(m[1]);
  return names;
}

describe('text SDF shaders — antialiasing', () => {
  it.each(FRAG_SHADERS)('%s derives its AA band from fwidth()', (_name, src) => {
    expect(src).toMatch(/aaW\s*=\s*max\(\s*0\.5\s*\*\s*fwidth\(sdfVal\)/);
  });

  it.each(FRAG_SHADERS)('%s centers the smoothstep on the threshold', (_name, src) => {
    expect(src).toMatch(/smoothstep\(\s*threshold\s*-\s*aaW\s*,\s*threshold\s*\+\s*aaW\s*,\s*sdfVal\s*\)/);
  });

  it.each(FRAG_SHADERS)('%s floors the band so a zero derivative cannot alias', (_name, src) => {
    // The floor is the whole reason `max()` is there. Without it a flat field
    // (or a driver returning fwidth === 0) collapses the smoothstep to a step,
    // which is exactly the hard-edged aliasing this shader exists to avoid.
    const floor = /max\([^)]*fwidth\(sdfVal\)\s*,\s*([0-9.]+)\)/.exec(src);
    expect(floor).not.toBeNull();
    expect(Number(floor![1])).toBeGreaterThan(0);
  });

  it.each(FRAG_SHADERS)('%s declares no constant AA-width uniform', (_name, src) => {
    // Regression guard: `u_aaWidth` was a CPU-set constant (0.05), which is
    // correct at exactly one combination of font size, zoom, and DPR.
    expect(declaredUniforms(src).has('u_aaWidth')).toBe(false);
  });

  it('does not advertise u_aaWidth for lookup', () => {
    expect(TEXT_SDF_UNIFORMS).not.toContain('u_aaWidth');
  });
});

describe('text SDF shaders — declaration lists match the sources', () => {
  // The invariant that would have caught the dead uniform: every name the
  // renderer looks up has to exist in a stage, or the lookup silently yields a
  // null location and whatever the CPU sets goes nowhere.
  const declared = new Set<string>([
    ...declaredUniforms(TEXT_VERT_SRC),
    ...declaredUniforms(TEXT_FRAG_SRC),
    ...declaredUniforms(TEXT_FRAG_R8_SRC),
  ]);

  it.each(TEXT_SDF_UNIFORMS)('%s is declared in at least one stage', (name) => {
    expect(declared.has(name)).toBe(true);
  });

  it('lists every uniform the stages declare', () => {
    expect([...declared].sort()).toEqual([...TEXT_SDF_UNIFORMS].sort());
  });

  it.each(TEXT_SDF_ATTRIBUTES)('%s is declared as a vertex input', (name) => {
    expect(declaredInputs(TEXT_VERT_SRC).has(name)).toBe(true);
  });
});
