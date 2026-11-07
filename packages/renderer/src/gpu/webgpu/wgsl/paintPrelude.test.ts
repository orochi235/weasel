import { describe, expect, it } from 'vitest';
import { reflectWgsl } from '../wgslReflect';
import { reflectEntries } from '../wgslEntries';
import { assemblePaintWgsl, PAINT_KIT_WGSL_NAMES } from './paintPrelude';
import { PATH_FILL_WGSL } from './pathFill';

/** Kit WGSL compiles without `uniform_buffer_standard_layout`. */
const STRICT = { standardLayout: false };

const FRAG = `
struct Params { u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: PaintVaryings) -> vec4f { return params.u_tint * fract(in.world.x); }`;

describe('the paint prelude', () => {
  it('reads the path vertex at a_position and writes color and id', () => {
    const entries = reflectEntries(assemblePaintWgsl({ frag: FRAG }));
    expect([entries.vertex, entries.fragment]).toEqual(['weasel_vs', 'weasel_fs']);
    expect(entries.attributes.get('a_position')).toBe(0);
    expect([...entries.outputs].sort()).toEqual([0, 1]);
  });

  it('declares a member for every kit uniform a paint draw sets', () => {
    const r = reflectWgsl(assemblePaintWgsl({ frag: FRAG }), STRICT);
    const kit = r.structs.get('PaintKit')!.members.map((m) => m.name);
    expect(kit.sort()).toEqual(Object.values(PAINT_KIT_WGSL_NAMES).sort());
  });

  it('calls the kind\'s own vertex stage where it has one', () => {
    const vert = 'fn vertex(v: PaintVertex) -> PaintVaryings { var o = kitVertex(v); o.world = o.screen; return o; }';
    expect(assemblePaintWgsl({ frag: FRAG, vert })).toContain('var o = vertex(v);');
  });

  it('keeps a whole module as it is', () => {
    expect(assemblePaintWgsl({ frag: PATH_FILL_WGSL })).toBe(PATH_FILL_WGSL);
  });
});
