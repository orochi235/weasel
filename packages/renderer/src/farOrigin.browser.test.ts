/**
 * Paints far from the origin, in a real context. The same one-unit square,
 * zoomed 64x, is drawn at world x = 0 and at x = 3,000,000.3, where a float32
 * holds a quarter of a unit, 16 pixels here. Each paint's pixels must
 * match between the two; the recorder tests replay the float32 arithmetic,
 * and this is what shows the shaders do it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, viewToMat3 } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { registerProgram, _resetProgramRegistryForTests } from './shaders/registerProgram';
import { registerPaintDrawKind } from './paintKinds';
import { meshDrawKind, seedMeshPatch } from './meshPaint/meshPaint';
import { resolvePatternSpec } from './patterns/resolveSpec';

const ZOOM = 64;
const FAR = 3_000_000.3;

let renderer: WeaselRenderer | undefined;
let release: (() => void) | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  release?.();
  release = undefined;
  _resetProgramRegistryForTests();
});

/** An even-odd square from `x0` one unit wide: even-odd so it draws through
 *  the path programs and not the batch. */
function square(x0: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L, L, Z]),
    coords: new Float32Array([0, 0, 1, 0, 1, 0.25, 0, 0.25]),
    origin: { x: x0, y: 0 },
    fillRule: 'evenodd',
  };
}

/** The red channel along the middle row of `commands(x0)` drawn under a view
 *  putting `x0` at the canvas's left edge. */
function row(x0: number, commands: (x0: number) => DrawCommand[]): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = ZOOM;
  canvas.height = 16;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: ZOOM, height: 16, dpr: 1 });
  const view = viewToMat3({ x: x0, y: 0, scale: { x: ZOOM, y: ZOOM } });
  renderer.render([{ kind: 'group', transform: view, children: commands(x0) }], view);
  const px = new Uint8Array(ZOOM * 16 * 4);
  gl.readPixels(0, 0, ZOOM, 16, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const out = Array.from({ length: ZOOM }, (_, x) => px[(8 * ZOOM + x) * 4]!);
  renderer.dispose();
  renderer = undefined;
  return out;
}

function expectSame(near: number[], far: number[]) {
  const worst = Math.max(...near.map((v, i) => Math.abs(v - far[i]!)));
  expect(worst, `near ${near.join(',')}\nfar  ${far.join(',')}`).toBeLessThanOrEqual(3);
  // Not a flat fill, which would match anywhere.
  expect(Math.max(...near) - Math.min(...near)).toBeGreaterThan(150);
}

describe('paints far from the origin, in a real context', () => {
  it('draws a world-space gradient as it does at the origin', () => {
    const at = (x0: number): DrawCommand[] => [{
      kind: 'path', path: square(x0),
      fill: { paint: {
        kind: 'linear-gradient', units: 'world', from: { x: x0, y: 0 }, to: { x: x0 + 1, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#f00' }],
      } },
    } as DrawCommand];
    expectSame(row(0, at), row(FAR, at));
  });

  it('draws a world-space pattern as it does at the origin', () => {
    const texture = resolvePatternSpec({ kind: 'hatch', color: '#f00' })!;
    const TILE = 0.25;
    const at = (x0: number): DrawCommand[] => [{
      kind: 'path', path: square(x0),
      fill: { paint: { kind: 'texture', texture, units: 'world', width: TILE, height: TILE } },
    } as DrawCommand];
    // The tiles start at the world origin, so the near run starts where FAR sits in its tile.
    expectSame(row(FAR - Math.floor(FAR / TILE) * TILE, at), row(FAR, at));
  });

  it("draws a shader command's world point as it does at the origin", () => {
    const program = registerProgram('far-origin-ramp', '', `#version 300 es
precision highp float;
in vec2 v_worldLocal;
uniform vec2 u_worldOrigin;
out vec4 outColor;
void main() {
  float x = fract(mod(u_worldOrigin.x, 1.0) + v_worldLocal.x);
  outColor = vec4(x, 0.0, 0.0, 1.0);
}
`);
    const at = (): DrawCommand[] => [{ kind: 'shader', program, uniforms: {}, bounds: { x: 0, y: 0, w: ZOOM, h: 16 } }];
    // The ramp is the world point's fraction, so the near run starts at FAR's.
    expectSame(row(FAR - Math.floor(FAR), at), row(FAR, at));
  });

  it('draws a world-space mesh gradient as it does at the origin', () => {
    release = registerPaintDrawKind(meshDrawKind);
    const seed = seedMeshPatch('#ff0000ff');
    const at = (x0: number): DrawCommand[] => [{
      kind: 'path', path: square(x0),
      fill: { paint: {
        ...seed, units: 'world',
        patches: seed.patches.map((p) => ({
          ...p,
          colors: ['#000000ff', '#ff0000ff', '#ff0000ff', '#000000ff'],
          points: p.points.map((q) => ({ x: x0 + q.x, y: q.y * 0.25 })),
        })),
      } },
    } as unknown as DrawCommand];
    const near = row(0, at);
    const far = row(FAR, at);
    const worst = Math.max(...near.map((v, i) => Math.abs(v - far[i]!)));
    expect(worst, `near ${near.join(',')}\nfar  ${far.join(',')}`).toBeLessThanOrEqual(3);
    expect(Math.max(...near)).toBeGreaterThan(100);
  });
});
