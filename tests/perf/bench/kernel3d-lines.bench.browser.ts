/**
 * kernel3d's line pass, timed in Chromium on the node's GPU: packing, a whole
 * frame that repacks (frame, pack, draw, finish), a frame drawing a buffer
 * packed once, and the draw alone with log depth off and on, for 1k, 10k and
 * 100k segments 6.4e6 m from the origin.
 *
 * Run on the fleet:
 *   onto do --kind bench --gui --task k3d-lines-bench --expect 10m -- npx vitest run --config tests/perf/vitest.kernel3d-lines.config.ts
 * To time an older pass beside the current one, put that commit's `lines/{head,pack,pass,pass.glsl}.ts` in
 * `./kernel3d-lines-before/` first (`git show <sha>:packages/kernel3d/src/lines/pack.ts > …`); it runs as `before`.
 * Every rep prints one `BENCH {json}` line, the raw record; nothing is averaged here.
 */
import { it } from 'vitest';
import type { Mat4, Vec3 } from '@weasel-js/geom/3d';
import * as kernel from '@weasel-js/kernel3d';

type Pack = (lines: readonly kernel.Line3[], origin?: Vec3) => Float32Array;
type Draw = (v: Float32Array, vp: Mat4, size: { width: number; height: number }, o?: kernel.LineDrawOptions) => void;
type CreatePass = (gl: WebGL2RenderingContext) => { draw: Draw; dispose(): void };

const before = import.meta.glob('./kernel3d-lines-before/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const oldPack = before['./kernel3d-lines-before/pack.ts']?.packLines as Pack | undefined;
const oldPass = before['./kernel3d-lines-before/pass.ts']?.createLinePass as CreatePass | undefined;

const W = 1280;
const H = 800;
const R = 6.4e6;
const SIZES = [1_000, 10_000, 100_000];
const REPS = 30;
const WARM = 5;

const emit = (record: Record<string, unknown>) => console.log(`BENCH ${JSON.stringify(record)}`);

/** `n` segments in runs of ten, scattered over a 40 m square 6.4e6 m up. */
function linesOf(n: number): kernel.Line3[] {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: kernel.Line3[] = [];
  for (let i = 0; i < n / 10; i++) {
    const points: Vec3[] = [];
    let x = rand() * 40 - 20, z = rand() * 40 - 20;
    for (let k = 0; k <= 10; k++) {
      points.push({ x, y: R, z });
      x += rand() - 0.5;
      z += rand() - 0.5;
    }
    out.push({ runs: [{ points }], color: [rand(), rand(), rand(), 1], width: 3, head: null });
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

it('times the line pass', { timeout: 900_000 }, () => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  document.body.append(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, stencil: true })!;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  emit({
    kind: 'env', ua: navigator.userAgent, cores: navigator.hardwareConcurrency,
    gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null, before: !!(oldPack && oldPass), reps: REPS, warm: WARM,
  });
  const camera = kernel.createCamera({ target: { x: 0, y: R, z: 0 }, distance: 50, pitch: 0.8, far: 1e7, depth: 'log' });
  const size = { width: W, height: H };
  const frame = kernel.cameraFrame(camera, W / H);
  const pass = kernel.createLinePass(gl);
  const prior = oldPass?.(gl);

  const impls = [
    ...(oldPack && prior ? [{
      name: 'before', pack: (l: kernel.Line3[]) => oldPack(l),
      frame: (l: kernel.Line3[]) => prior.draw(oldPack(l), kernel.cameraViewProjection(camera, W / H), size),
    }] : []),
    {
      name: 'after', pack: (l: kernel.Line3[]) => kernel.packLines(l, frame.origin),
      frame: (l: kernel.Line3[]) => {
        const f = kernel.cameraFrame(camera, W / H);
        pass.draw(kernel.packLines(l, f.origin), f.viewProjection, size);
      },
    },
  ];
  const cases = SIZES.length * (impls.length * 3 + 4);
  let done = 0;
  const clear = (depth = 1) => {
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(depth);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
  const time = (run: () => void, finish: boolean): number => {
    const t0 = performance.now();
    run();
    if (finish) gl.finish();
    return performance.now() - t0;
  };
  /** Each rep runs every variant once, the order turned each rep so drift falls on all of them. */
  const measure = (
    what: string, n: number, variants: { name: string; run: () => void; clearDepth?: number }[], finish: boolean,
  ) => {
    const ms: Record<string, number[]> = Object.fromEntries(variants.map((v) => [v.name, []]));
    for (let rep = -WARM; rep < REPS; rep++) {
      const order = rep % 2 ? [...variants].reverse() : variants;
      for (const v of order) {
        if (finish) { clear(v.clearDepth); gl.finish(); }
        const t = time(v.run, finish);
        if (rep >= 0) {
          ms[v.name].push(t);
          emit({ kind: 'rep', what, n, variant: v.name, rep, ms: t });
        }
      }
    }
    for (const v of variants) {
      done++;
      console.log(`${done}/${cases} ${what} ${v.name} ${n}: median ${median(ms[v.name]).toFixed(3)} ms`);
    }
  };

  for (const n of SIZES) {
    const lines = linesOf(n);
    measure('pack', n, impls.map((i) => ({ name: i.name, run: () => i.pack(lines) })), false);
    measure('frame', n, impls.map((i) => ({ name: i.name, run: () => i.frame(lines) })), true);
    // A buffer packed once and kept: the camera moves, the lines do not. After, the origin is a fixed point 50 m from
    // the eye, and each frame takes cameraFrame's matrix relative to it.
    const anchor = { x: 0, y: R, z: 0 };
    const kept = kernel.packLines(lines, anchor);
    const keptBefore = oldPack?.(lines);
    measure('kept', n, [
      ...(keptBefore && prior ? [{
        name: 'before', run: () => prior.draw(keptBefore, kernel.cameraViewProjection(camera, W / H), size),
      }] : []),
      { name: 'after', run: () => pass.draw(kept, kernel.cameraFrame(camera, W / H, undefined, anchor).viewProjection, size) },
    ], true);
    const packed = kernel.packLines(lines, frame.origin);
    measure('draw', n, [
      { name: 'log-off', run: () => pass.draw(packed, frame.viewProjection, size) },
      { name: 'log-on', run: () => pass.draw(packed, frame.viewProjection, size, { logDepth: frame.logDepth }) },
      // Behind a depth buffer cleared to 0, every fragment fails: what writing gl_FragDepth costs is the early test.
      { name: 'log-off-hidden', clearDepth: 0, run: () => pass.draw(packed, frame.viewProjection, size) },
      {
        name: 'log-on-hidden', clearDepth: 0,
        run: () => pass.draw(packed, frame.viewProjection, size, { logDepth: frame.logDepth }),
      },
    ], true);
  }
  pass.dispose();
  prior?.dispose();
});
