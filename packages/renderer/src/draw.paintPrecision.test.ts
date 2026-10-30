import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, viewToMat3 } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import type { ShaderProgram } from './shaders/ShaderProgram';
import { _resetTextureRegistryForTests } from './textures/registerTexture';
import { resolvePatternSpec, _resetPatternSpecCacheForTests } from './patterns/resolveSpec';
import {
  installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas,
} from './patterns/test-utils/fakeOffscreenCanvas';
import { registerPaintDrawKind } from './paintKinds';
import { meshDrawKind, seedMeshPatch } from './meshPaint/meshPaint';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

/**
 * A `units: 'world'` paint far from the origin and zoomed in. The paint
 * programs find each fragment's paint-space point from its screen position
 * through `u_worldInv`, in float32, and at world x = 262,144 a float32 holds a
 * thirty-second of a unit: 2 px at 64x. Nothing here runs a shader, so each
 * test replays the stage's float32 arithmetic over what the renderer uploaded.
 */
const WORLD_X = 262_144;
const ZOOM = 64;
const STEP_PX = 0.25;
const PANS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** The fragment the tests ask about, at a pixel center. */
const SX = 32.5;
const SY = 16.5;

const f = Math.fround;

/** An even-odd square beside `WORLD_X`: its mesh needs the stencil, so it
 *  draws through the path programs and not the batch. */
const SQUARE: PolygonPath = stencilledEvenOdd({
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([WORLD_X, 0, WORLD_X + 4, 0, WORLD_X + 4, 4, WORLD_X, 4]),
});

function frame(paint: unknown, px: number) {
  const rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
  rec.reset();
  const view = viewToMat3({ x: WORLD_X - px / ZOOM, y: 0, scale: { x: ZOOM, y: ZOOM } });
  r.render([{
    kind: 'group', transform: view,
    children: [{ kind: 'path', path: SQUARE, fill: { paint } } as DrawCommand],
  }], view);
  return { rec, r };
}

/** The last `name` call that sent `prog` its `uniform`. */
function sent(rec: ReturnType<typeof makeGLRecorder>, prog: ShaderProgram, name: string, uniform: string) {
  const loc = prog.uniform(uniform);
  expect(loc, `${uniform} has no location`).toBeDefined();
  return rec.calls.filter((c) => c.name === name && c.args[0] === loc).at(-1);
}

/** The program that was asked for `name`, as {@link sent} reads one: by the
 *  locations the recorder handed back for it. */
function programDeclaring(rec: ReturnType<typeof makeGLRecorder>, name: string): ShaderProgram {
  const handle = rec.calls.find((c) => c.name === 'getUniformLocation' && c.args[1] === name)!.args[0];
  const uniform = (u: string) =>
    rec.calls.find((c) => c.name === 'getUniformLocation' && c.args[0] === handle && c.args[1] === u)?.result as
      WebGLUniformLocation | undefined;
  return { uniform } as unknown as ShaderProgram;
}

/** `(u_worldInv * vec3(screen, 1.0)).xy` as the vertex stage computes it. */
function paintPoint(worldInv: Float32Array, sx: number, sy: number): [number, number] {
  const m = Float32Array.from(worldInv);
  return [
    f(f(f(m[0] * sx) + f(m[3] * sy)) + m[6]),
    f(f(f(m[1] * sx) + f(m[4] * sy)) + m[7]),
  ];
}

describe('paint space far from the origin (world x = 262,144 at 64x)', () => {
  it('moves a world-space gradient under a quarter-pixel pan by a quarter pixel', () => {
    // One world unit long, so the ramp position is the distance past WORLD_X.
    const paint = {
      kind: 'linear-gradient', units: 'world',
      from: { x: WORLD_X, y: 0 }, to: { x: WORLD_X + 1, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    };
    for (const k of PANS) {
      const { rec, r } = frame(paint, k * STEP_PX);
      const prog = r._gradFill();
      const worldInv = sent(rec, prog, 'uniformMatrix3fv', 'u_worldInv')!.args[2] as Float32Array;
      const [wx, wy] = paintPoint(worldInv, SX, SY);
      const dir = sent(rec, prog, 'uniform2f', 'u_gradDir')!.args.slice(1) as number[];
      const len = sent(rec, prog, 'uniform1f', 'u_gradLen')!.args[1] as number;
      // The shader's `dot(world, u_gradDir) / u_gradLen`.
      const t = f(f(f(wx * f(dir[0])) + f(wy * f(dir[1]))) / f(len));
      expect(t, `pan ${k}`).toBeCloseTo((SX - k * STEP_PX) / ZOOM, 5);
    }
  });

  describe('a pattern', () => {
    beforeEach(() => {
      installFakeOffscreenCanvas();
      _resetPatternSpecCacheForTests();
      _resetTextureRegistryForTests();
    });
    afterEach(() => uninstallFakeOffscreenCanvas());

    it('places a world-space tile under a quarter-pixel pan to a hundredth of a texel', () => {
      const texture = resolvePatternSpec({ kind: 'dots', color: '#fff' })!;
      const paint = { kind: 'texture', texture, units: 'world' };
      for (const k of PANS) {
        const { rec, r } = frame(paint, k * STEP_PX);
        const prog = r._patternFill();
        const worldInv = sent(rec, prog, 'uniformMatrix3fv', 'u_worldInv')!.args[2] as Float32Array;
        const [tw] = sent(rec, prog, 'uniform2f', 'u_tileSize')!.args.slice(1) as number[];
        const [wx] = paintPoint(worldInv, SX, SY);
        // Where in its tile the fragment lands, in texels: what REPEAT leaves of u.
        const u = f(wx / f(tw));
        const got = (u - Math.floor(u)) * tw;
        const world = WORLD_X + (SX - k * STEP_PX) / ZOOM;
        const want = world - Math.floor(world / tw) * tw;
        expect(Math.abs(got - want), `pan ${k}`).toBeLessThan(0.01);
      }
    });
  });

  describe('a mesh gradient', () => {
    let release: () => void;
    beforeEach(() => { release = registerPaintDrawKind(meshDrawKind); });
    afterEach(() => release());

    it('moves a world-space mesh under a quarter-pixel pan by a quarter pixel, and its geometry with it', () => {
      const seed = seedMeshPatch('#ff0000ff');
      const paint = {
        ...seed, units: 'world',
        patches: seed.patches.map((p) => ({ ...p, points: p.points.map((q) => ({ x: WORLD_X + q.x * 4, y: q.y * 4 })) })),
      };
      const ts: number[] = [];
      let width = 0;
      for (const k of PANS) {
        const { rec } = frame(paint, k * STEP_PX);
        const prog = programDeclaring(rec, 'u_meshSize');
        const worldInv = sent(rec, prog, 'uniformMatrix3fv', 'u_worldInv')!.args[2] as Float32Array;
        [width] = sent(rec, prog, 'uniform2f', 'u_meshSize')!.args.slice(1) as number[];
        // The shader's `v_world / u_meshSize`.
        ts.push(f(paintPoint(worldInv, SX, SY)[0] / f(width)));
        // The model's translation is what is left past u_origin: a few pixels, not millions.
        const model = sent(rec, prog, 'uniformMatrix3fv', 'u_model')!.args[2] as Float32Array;
        expect(Math.abs(model[6]!), `pan ${k}`).toBeLessThan(1e4);
      }
      for (const [k, t] of ts.entries()) {
        expect((t - ts[0]!) * width, `pan ${k}`).toBeCloseTo((-k * STEP_PX) / ZOOM, 4);
      }
    });
  });
});
