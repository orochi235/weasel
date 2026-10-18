import type { Path, GlMat3 } from '@weasel-js/geom';
import type { PaintResources } from '../paintKinds';
import type { GroupState } from '../state/GroupState';
import type { GLMeshCache } from '../cache/GLMeshCache';
import type { GLTextureCache } from '../cache/GLTextureCache';
import type { GLImageCache } from '../cache/GLImageCache';
import type { GradientRampAtlas } from '../cache/GradientRampAtlas';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { DrawBatch } from '../drawBatch';
import type { ClipRect } from '../batchClip';
import type { EffectTargets } from '../effects/EffectTargets';
import type { RetainedSurfaces } from '../retain/RetainedSurfaces';
import type { PaintScratch } from '../paintScratch';
import type { StagedBatchState } from './batchRun';
import type { FlattenTolerance } from './flattenTolerance';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  pathFillVColor: ShaderProgram;
  /** The program a batch flush draws a run under one color matrix with —
   *  `shaders/batchFill.ts`. */
  batchFill: ShaderProgram;
  /** The same for a run under more than one. Absent where a caller drives the
   *  draw functions without a renderer behind them, which then draws every run
   *  with `batchFill`. */
  readonly batchFillMatrices?: ShaderProgram;
  gradFill: ShaderProgram;
  patternFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRamps: GradientRampAtlas;
  programRegistry: Map<string, ShaderProgram>;
  /** Compile-on-first-use for a registered paint kind's program. Absent when
   *  a caller drives `dispatch` without a renderer behind it. */
  ensureProgram?(id: string): ShaderProgram | null;
  /** The program atlas glyphs under a texture paint draw with, compiled on
   *  first use. Absent without a renderer behind the context, and then such
   *  glyphs draw nothing. */
  glyphPaintProgram?(kind: GlyphPaintKind): ShaderProgram;
  quadVbo: WebGLBuffer | null;
  quadIbo: WebGLBuffer | null;
  /** Staging for the batch. Draws are deferred into it, so a caller driving
   *  `dispatch` itself must `flushBatch` when the stream ends. */
  drawBatch: DrawBatch;
  /** What the staged run draws under, and what it samples;
   *  `undefined` while nothing is staged. Written only by the push helpers
   *  and `flushBatch`. */
  batchState?: StagedBatchState;
  /** 1x1 white texture, bound for a flush that samples no image so a solid
   *  vertex's `texture() * color` is its color. */
  whiteTexture: WebGLTexture | null;
  state: GroupState;
  widthCss: number;
  heightCss: number;
  /**
   * Current clip nesting depth. Tracked as a flat scalar on DrawContext (not
   * part of GroupState's per-frame stack) because it must survive pop() during
   * drawGroup teardown — we decrement it manually after popClip. Starts at 0;
   * incremented/decremented symmetrically by drawGroup around cmd.clip pushes.
   */
  clipDepth: number;
  /** The clips of the groups drawing now, outermost first. See `enterClip`. */
  clipStack: ClipEntry[];
  /** Set while `enterUncut` stages an item the rect clips could not cut. */
  uncut?: boolean;
  /** Flatness tolerance for curve tessellation, a `{ px }` one in CSS pixels;
   *  `flattenToleranceOf` resolves it per path. Unset is half a pixel. See
   *  `WeaselRendererOptions.flattenTolerance`. */
  flattenTolerance?: FlattenTolerance;
  /** On-screen glyph size (CSS px) at which text switches to tessellated
   *  outlines. See `WeaselRendererOptions.textOutlineMinScreenSize`. */
  textOutlineMinScreenSize?: number;
  /** World→screen transform for the frame, when the caller supplied one.
   *  Only `units: 'world'` gradients read it; absent, they fall back to
   *  screen space. See `WeaselRenderer.render`. */
  viewMatrix?: GlMat3;
  /** Offscreen buffers for group effects. Absent when a caller drives
   *  `dispatch` without a renderer behind it, in which case a group's
   *  `effects` are skipped and its children draw straight through — the same
   *  answer an unregistered effect program gets, and the one that keeps a
   *  frame on screen. */
  effectTargets?: EffectTargets;
  /** Where this renderer is currently drawing. `null` is the default
   *  framebuffer. Tracked here rather than read back with `getParameter`
   *  because a group's effects nest, and each has to restore its parent's. */
  renderTarget?: { readonly fbo: WebGLFramebuffer } | null;
  /** Where groups carrying `retain` keep their pixels between frames. Absent
   *  without a renderer behind the context, and then they draw straight
   *  through. */
  retained?: RetainedSurfaces;
  /** Device-pixel size of the drawing buffer, which is what an offscreen
   *  target is sized to. */
  deviceWidth?: number;
  deviceHeight?: number;
  /** Put the viewport and scissor back to the renderer's own rect after a
   *  group's effects have borrowed them for a full-buffer pass. The renderer
   *  owns that rect — see `WeaselRenderer.applyTarget` — and a second copy of
   *  its y-flip here would be a second thing to keep in step. */
  restoreTargetRect?(): void;
  /** Where a registered paint kind renders for atlas glyphs to sample. Absent
   *  without a renderer behind the context, and then such glyphs draw
   *  nothing. */
  paintScratch?: PaintScratch;
  /** The lifetime a registered paint kind's GPU state belongs to. Absent
   *  when a caller drives `dispatch` without a renderer behind it, in which
   *  case one per context stands in and is never released. */
  paintResources?: PaintResources;
  /** Per-frame counters the renderer reads back after the stream ends.
   *  Absent, nothing is counted. */
  stats?: { drawCalls: number };
}

/** One clipped group's clip, while its children draw. */
export interface ClipEntry {
  path: Path;
  /** The group's transform, which `path` is in. */
  transform: GlMat3;
  /** Where staged geometry is cut, for a clip that is an axis-aligned rect;
   *  `null` for one only the stencil can express. */
  rect: ClipRect | null;
  /** The stencil bit this clip holds, or 0 while it holds none. */
  depth: number;
}

/** The paints atlas glyphs draw through a program of their own: `texture` is
 *  a registered kind, which renders into `paintScratch` for the glyphs to
 *  sample. */
export type GlyphPaintKind = 'pattern' | 'gradient' | 'texture';
