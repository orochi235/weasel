import { describe, it, expect, vi } from 'vitest';
import { makeGLRecorder } from '../../renderer/test-utils/glRecorder';
import { getPaintKind, listPaintKinds } from '../../core/paintKinds';
import { fillInPoseFrame, fillToBoundsFrame } from '../../core/fillInPoseFrame';
import { seedMeshPatch, isMeshGradientFill, meshGradientXml, MESH_GRADIENT_KIND } from './meshPaint';
import type { MeshGradientFill } from './meshPaint';
import type { FillStyle } from '@weasel-js/paint';
import type { PaintBindContext, PaintProgram } from '../../core/paintKinds';

const BOX = { x: 10, y: 20, width: 200, height: 100 };

const entry = () => getPaintKind(MESH_GRADIENT_KIND)!;

function bindContext(): {
  ctx: PaintBindContext;
  gl: WebGL2RenderingContext;
  calls: () => string[];
  argsOf: (name: string) => readonly unknown[][];
  program: PaintProgram;
} {
  const rec = makeGLRecorder();
  const uniforms = new Map<string, object>();
  const program = {
    handle: {} as WebGLProgram,
    uniform: (name: string) => {
      if (!uniforms.has(name)) uniforms.set(name, { name });
      return uniforms.get(name) as WebGLUniformLocation;
    },
  } as unknown as PaintProgram;
  const ctx: PaintBindContext = {
    gl: rec.gl,
    alpha: 1,
    program: () => program,
    setProjAndModel: vi.fn(),
    spaceInverse: () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) as unknown as ReturnType<PaintBindContext['spaceInverse']>,
    bindRamp: () => 0,
  };
  return {
    ctx,
    gl: rec.gl,
    calls: () => rec.calls.map((c) => c.name),
    argsOf: (name) => rec.calls.filter((c) => c.name === name).map((c) => [...c.args]),
    program,
  };
}

describe('the mesh-gradient kind', () => {
  it('is registered, so an editor kind bar lists it', () => {
    expect(listPaintKinds().map((e) => e.id)).toContain(MESH_GRADIENT_KIND);
    expect(entry().label).toBe('Mesh');
  });

  it('seeds a patch from a color rather than a rectangle', () => {
    const seeded = entry().seed('#3fb08cff') as unknown as MeshGradientFill;
    expect(isMeshGradientFill(seeded as unknown as FillStyle)).toBe(true);
    expect(seeded.patches).toHaveLength(1);
    expect(seeded.patches[0].points).toHaveLength(12);
    expect(seeded.units).toBe('bounds');
    // The edges bow, so the seed is visibly a mesh.
    const straight = seeded.patches[0].points.every((p) => p.x === 0 || p.x === 1 || p.y === 0 || p.y === 1);
    expect(straight).toBe(false);
  });

  it('shows the first corner color, which is what a fallback swatch reads', () => {
    expect(entry().colorOf(seedMeshPatch('#123456ff') as unknown as FillStyle)).toBe('#123456ff');
  });

  it('round-trips through the pose frame and back', () => {
    const mesh = seedMeshPatch('#ff0000ff') as unknown as FillStyle;
    const posed = fillInPoseFrame(mesh, BOX) as unknown as MeshGradientFill;
    expect(posed.units).toBe('local');
    expect(posed.patches[0].points[0]).toEqual({ x: 10, y: 20 });

    const back = fillToBoundsFrame(posed as unknown as FillStyle, BOX) as unknown as MeshGradientFill;
    expect(back.units).toBe('bounds');
    const before = (mesh as unknown as MeshGradientFill).patches[0].points;
    back.patches[0].points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before[i].x, 10);
      expect(p.y).toBeCloseTo(before[i].y, 10);
    });
  });

  it('writes a private-namespace def carrying every point in full', () => {
    const mesh = seedMeshPatch('#ff0000ff');
    const xml = meshGradientXml('grad0', mesh);
    expect(xml).toContain('<wzl:meshGradient id="grad0" gradientUnits="objectBoundingBox">');
    expect(xml).toContain('<wzl:patch points="');
    // Twelve points, so a reader never has to infer a shared edge.
    const points = /points="([^"]+)"/.exec(xml)![1].split(' ');
    expect(points).toHaveLength(12);
    expect(xml).toContain('colors="#ff0000ff #ff0000 #ff0000ff #ff0000"');
  });

  it('names a non-default blend space in the def', () => {
    const mesh = { ...seedMeshPatch('#ff0000ff'), interpolate: 'oklch' as const };
    expect(meshGradientXml('grad0', mesh)).toContain('interpolate="oklch"');
    expect(meshGradientXml('grad0', { ...mesh, interpolate: 'rgb' })).not.toContain('interpolate=');
  });
});

describe('binding a mesh paint', () => {
  it('uploads the bake once and reuses it for the same paint', () => {
    const { ctx, calls } = bindContext();
    const mesh = seedMeshPatch('#ff0000ff') as unknown as FillStyle;

    expect(entry().bind!(ctx, mesh)).not.toBeNull();
    const first = calls().filter((n) => n === 'texImage2D').length;
    expect(first).toBe(1);

    entry().bind!(ctx, mesh);
    expect(calls().filter((n) => n === 'texImage2D').length).toBe(1);
  });

  it('clamps the bake, since a mesh is not a tile', () => {
    const { ctx, gl, argsOf } = bindContext();
    entry().bind!(ctx, seedMeshPatch('#ff0000ff') as unknown as FillStyle);
    const wraps = argsOf('texParameteri').filter(
      ([, name]) => name === gl.TEXTURE_WRAP_S || name === gl.TEXTURE_WRAP_T,
    );
    expect(wraps).toHaveLength(2);
    expect(wraps.every(([, , value]) => value === gl.CLAMP_TO_EDGE)).toBe(true);
  });

  it('declines a mesh with no drawable patch rather than painting a blank', () => {
    const { ctx } = bindContext();
    const empty = { fill: MESH_GRADIENT_KIND, patches: [] } as unknown as FillStyle;
    expect(entry().bind!(ctx, empty)).toBeNull();
  });

  it('declines when the paint space has no inverse', () => {
    const { ctx } = bindContext();
    const flattened: PaintBindContext = { ...ctx, spaceInverse: () => null };
    expect(entry().bind!(flattened, seedMeshPatch('#ff0000ff') as unknown as FillStyle)).toBeNull();
  });
});
