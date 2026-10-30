/**
 * A `DrawContext` over a GL recorder, and readers for what the batch staged
 * into it. For tests that call the draw functions directly rather than going
 * through `WeaselRenderer.render`.
 */

import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/geom';
import type { PolygonPath } from '@weasel-js/geom';
import { makeGLRecorder } from './glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import { flushBatch, type DrawContext } from '../draw';
import { FLOATS_PER_VERTEX, TEX_SLOT_OFFSET } from '../drawBatch';
import { paintModeOf } from '../shaders/batchFill';

/**
 * Build a DrawContext backed by a GL recorder. Mirrors what WeaselRenderer.render
 * assembles internally, using the _*() accessors exposed for testing.
 */
export function createRecorderCtx(): { ctx: DrawContext; calls: ReturnType<typeof makeGLRecorder>['calls']; gl: ReturnType<typeof makeGLRecorder>['gl'] } {
  const recorder = makeGLRecorder();
  const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  // Built before the reset, as they were when the renderer built them all eagerly.
  const programs = {
    pathFill: r._pathFill(),
    pathFillVColor: r._pathFillVColor(),
    batchFill: r._batchFill(),
    batchVariants: r._batchVariants(),
    gradFill: r._gradFill(),
    patternFill: r._patternFill(),
  };
  r._batchVariants().get(true, false);
  // The build a run holding small glyphs draws with, which takes the same vertices.
  const areaBuild = r._batchVariants().get(false, false, true).handle;
  recorder.reset();
  const ctx: DrawContext = {
    gl: recorder.gl,
    ...programs,
    meshCache: r._meshCache(),
    textureCache: r._textureCache(),
    imageCache: r._imageCache(),
    gradRamps: r._gradRamps(),
    programRegistry: new Map(),
    quadVbo: null,
    quadIbo: null,
    drawBatch: r._drawBatch(),
    whiteTexture: null,
    state: r._groupState(),
    widthCss: r._widthCss(),
    heightCss: r._heightCss(),
    clipDepth: 0,
    clipStack: [],
  };
  AREA_BUILDS.set(ctx, areaBuild);
  return { ctx, calls: recorder.calls, gl: recorder.gl };
}

/** Each recorder context's batch build with the glyph taps. */
const AREA_BUILDS = new WeakMap<DrawContext, unknown>();

/** Whether `handle` is a batch build a plain run draws with: the default, or
 *  the one a run holding small glyphs takes. */
export function isBatchBuild(ctx: DrawContext, handle: unknown): boolean {
  return handle === ctx.batchFill.handle || handle === AREA_BUILDS.get(ctx);
}

/**
 * A vertex-data upload, whichever call carried it. The text ring writes into a
 * slot whose buffer it already owns, so its geometry arrives by
 * `bufferSubData`; every other draw path still mints a buffer and uses
 * `bufferData`.
 */
const isVertexUpload = (c: { name: string; args: readonly unknown[] }): boolean =>
  (c.name === 'bufferData' && c.args[1] instanceof Float32Array)
  || (c.name === 'bufferSubData' && c.args[2] instanceof Float32Array);

/**
 * The floats an upload actually sent.
 *
 * A `bufferSubData` from the batch names a window into a scratch array it
 * reuses across frames, so the recorded argument is the whole scratch with the
 * previous run's tail still in it.
 */
const uploadFloats = (c: { name: string; args: readonly unknown[] }): Float32Array => {
  const data = (c.name === 'bufferData' ? c.args[1] : c.args[2]) as Float32Array;
  if (c.name !== 'bufferSubData') return data;
  const srcOffset = typeof c.args[3] === 'number' ? c.args[3] : 0;
  const length = typeof c.args[4] === 'number' ? c.args[4] : data.length - srcOffset;
  return data.subarray(srcOffset, srcOffset + length);
};

/**
 * Every vertex the batch staged this frame, concatenated, after draining
 * whatever run is still open.
 *
 * `dispatch` alone leaves a run staged — only a flush uploads it — so a test
 * reading geometry has to close the frame the way `render` would.
 */
export function stagedVertices(ctx: DrawContext, calls: readonly { name: string; args: readonly unknown[] }[]): Float32Array {
  flushBatch(ctx);
  const runs: Float32Array[] = [];
  let bound: unknown = null;
  for (const c of calls) {
    if (c.name === 'useProgram') bound = c.args[0];
    if (isBatchBuild(ctx, bound) && isVertexUpload(c) && c.args[0] === 0x8892) {
      runs.push(uploadFloats(c));
    }
  }
  const total = runs.reduce((n, r) => n + r.length, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const r of runs) { out.set(r, at); at += r.length; }
  return out;
}

/**
 * Which tiers painted, read off the staged vertices.
 *
 * One program draws everything now, so `useProgram` no longer names a tier and
 * the per-vertex paint mode is what does: 0 is solid geometry — a rect, a
 * tessellated glyph outline, a decoration rule — `GLYPH_MODE_MSDF` a glyph off
 * a baked atlas, `GLYPH_MODE_R8` one off the runtime canvas bake.
 */
export function paintModes(ctx: DrawContext, calls: readonly { name: string; args: readonly unknown[] }[]): Set<number> {
  const verts = stagedVertices(ctx, calls);
  const modes = new Set<number>();
  for (let i = 0; i < verts.length; i += FLOATS_PER_VERTEX) {
    modes.add(paintModeOf(verts[i + TEX_SLOT_OFFSET]));
  }
  return modes;
}

/** The `(x, y)` of every staged vertex carrying `mode`, in staging order. */
export function positionsOfMode(
  ctx: DrawContext,
  calls: readonly { name: string; args: readonly unknown[] }[],
  mode: number,
): number[] {
  const verts = stagedVertices(ctx, calls);
  const out: number[] = [];
  for (let i = 0; i < verts.length; i += FLOATS_PER_VERTEX) {
    if (paintModeOf(verts[i + TEX_SLOT_OFFSET]) === mode) out.push(verts[i], verts[i + 1]);
  }
  return out;
}

/** A square no CPU cut can stand in for, so the clip goes through the stencil. */
export const SQUARE_CLIP: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  fillRule: 'nonzero',
};
