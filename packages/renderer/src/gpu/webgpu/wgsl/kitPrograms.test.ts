import { describe, expect, it } from 'vitest';
import { BATCH_FILL_UNIFORMS, BATCH_HULL_UNIFORMS, BATCH_TEXTURE_SLOTS } from '../../../shaders/batchFill';
import { GLYPH_GRAD_UNIFORMS, GLYPH_PATTERN_UNIFORMS, GLYPH_TEXTURE_UNIFORMS } from '../../../shaders/glyphPaint';
import { GRAD_FILL_UNIFORMS } from '../../../shaders/gradFill';
import { PATH_FILL_UNIFORMS } from '../../../shaders/pathFill';
import { PATTERN_FILL_UNIFORMS } from '../../../shaders/patternFill';
import { TRIMMED_RIBBON_UNIFORMS } from '../../../shaders/trimmedRibbon';
import { MESH_UNIFORMS } from '../../../meshPaint/meshShader';
import { reflectWgsl } from '../wgslReflect';
import { createUniformBlock } from '../wgslUniforms';
import { batchFillWgsl } from './batchFill';
import { KIT_WGSL_PROGRAMS } from './kitPrograms';
import { reflectEntries } from '../wgslEntries';

const COMPOSITE = ['u_source', 'u_alpha', 'u_colorMatrix', 'u_colorBias'];
const ID_COMPOSITE = ['u_source', 'u_ids', 'u_resolution', 'u_alpha', 'u_groupId'];

/** Each program's GLSL uniform names, which its WGSL must declare. */
function glslNames(name: string): readonly string[] {
  if (name.startsWith('batchFill')) return name.includes('hulls=true') ? BATCH_HULL_UNIFORMS : BATCH_FILL_UNIFORMS;
  const table: Record<string, readonly string[]> = {
    pathFill: PATH_FILL_UNIFORMS, pathFillVColor: PATH_FILL_UNIFORMS, gradFill: GRAD_FILL_UNIFORMS,
    patternFill: PATTERN_FILL_UNIFORMS, trimmedRibbon: TRIMMED_RIBBON_UNIFORMS,
    glyphPattern: GLYPH_PATTERN_UNIFORMS, glyphGrad: GLYPH_GRAD_UNIFORMS, glyphTexture: GLYPH_TEXTURE_UNIFORMS,
    composite: COMPOSITE, idComposite: ID_COMPOSITE, blur: ['u_direction', 'u_radius'],
    vignette: ['u_amount', 'u_feather'], 'kit:mesh-gradient': MESH_UNIFORMS, 'test/own-draw': PATH_FILL_UNIFORMS,
  };
  return table[name];
}

describe('the kit WGSL programs', () => {
  it.each(KIT_WGSL_PROGRAMS.map((p) => [p.name, p] as const))('%s declares every GLSL uniform by its name', (_, p) => {
    const r = reflectWgsl(p.code);
    const declared = new Set<string>(r.bindings.map((b) => b.name));
    for (const b of r.bindings) {
      if (b.struct) for (const m of r.structs.get(b.struct)!.members) declared.add(m.name);
    }
    const missing = glslNames(p.name).flatMap((n) => n === 'u_samplers'
      ? Array.from({ length: BATCH_TEXTURE_SLOTS }, (_, i) => `u_samplers_${i}`)
      : [n]).filter((n) => !declared.has(n));
    expect(missing).toEqual([]);
    if (p.outputs !== 'id' && !p.effect) expect(declared.has('u_weaselId')).toBe(true);
  });

  it.each(KIT_WGSL_PROGRAMS.map((p) => [p.name, p] as const))('%s reads its attributes at the locations it lists', (_, p) => {
    const entries = reflectEntries(p.code);
    expect(entries.vertex).toBe(p.effect ? 'weasel_vs' : 'vs');
    for (const [name, location] of Object.entries(p.locations)) expect(entries.attributes.get(name)).toBe(location);
    expect([...entries.outputs].sort()).toEqual(p.outputs === 'color' ? [0] : p.outputs === 'id' ? [1] : [0, 1]);
  });

  it('pairs each batch texture with a sampler but the white texel', () => {
    const names = reflectWgsl(batchFillWgsl({ matrices: true, hulls: true, area: true })).bindings.map((b) => b.name);
    expect(names.filter((n) => /^u_samplers_\d+$/.test(n))).toHaveLength(16);
    expect(names.filter((n) => n.endsWith('_sampler'))).toHaveLength(15);
    expect(names).not.toContain('u_samplers_0_sampler');
  });

  it('packs a float and a vec2 uniform array one element to 16 bytes, as GL takes them flat', () => {
    const block = createUniformBlock(reflectWgsl(batchFillWgsl({ matrices: true, hulls: false, area: false })), 'Uniforms');
    expect(block.set('u_alpha', [0.25, 0.5, 0.75, 1, 1, 1, 1, 1])).toBe(true);
    expect(block.set('u_fieldScale[2]', [3, 4])).toBe(true);
    const r = reflectWgsl(batchFillWgsl({ matrices: true, hulls: false, area: false }));
    const at = (name: string) => r.structs.get('Uniforms')!.members.find((m) => m.name === name)!.offset;
    const f = new Float32Array(block.bytes);
    expect([f[at('u_alpha') / 4], f[at('u_alpha') / 4 + 4], f[at('u_alpha') / 4 + 8]]).toEqual([0.25, 0.5, 0.75]);
    expect([f[at('u_fieldScale') / 4 + 8], f[at('u_fieldScale') / 4 + 9]]).toEqual([3, 4]);
  });
});
