import type { BlendFactors } from '../effects/compositeOp';
import { PREMULTIPLIED } from '../gpu/blend';
import type { GpuDrawState, GpuGeometry, GpuStencilState } from '../gpu/types';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import { idDrawn } from './idFrame';

/** What a draw is drawn under beyond its program and geometry. */
export interface DrawOptions {
  /** Absent, no stencil test: the caller names a clip test explicitly. */
  readonly stencil?: GpuStencilState | null;
  /** Default `true`. */
  readonly colorWrite?: boolean;
  /** Default premultiplied source-over; `null` unblended. */
  readonly blend?: BlendFactors | null;
  /** Whether the id attachment is written, for a program that writes it
   *  itself. Absent, an id frame decides from the paint's id. */
  readonly ids?: boolean;
  readonly firstIndex?: number;
}

const NO_OPTIONS: DrawOptions = {};

/** Reused: the backend reads a draw's state before it returns. */
const STATE: { -readonly [K in keyof GpuDrawState]: GpuDrawState[K] } = {
  program: null as unknown as ShaderProgram, blend: PREMULTIPLIED, colorWrite: true, stencil: null, ids: false,
};

/** Every draw the renderer issues goes through here, so the frame's
 *  draw-call count cannot miss one, and an id frame's id reaches every draw. */
export function drawTriangles(
  ctx: DrawContext, program: ShaderProgram, geometry: GpuGeometry, count: number,
  options: DrawOptions = NO_OPTIONS,
): void {
  const colorWrite = options.colorWrite ?? true;
  STATE.program = program;
  STATE.blend = options.blend === undefined ? PREMULTIPLIED : options.blend;
  STATE.colorWrite = colorWrite;
  STATE.stencil = options.stencil ?? null;
  STATE.ids = options.ids ?? (ctx.ids !== undefined && colorWrite && idDrawn(ctx, ctx.ids, program));
  ctx.gpu.draw(STATE, geometry, count, options.firstIndex);
  if (ctx.stats) ctx.stats.drawCalls++;
}
