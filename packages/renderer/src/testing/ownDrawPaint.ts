import { registerPaintDrawKind } from '../paintKinds';
import { VERT_SRC, FRAG_SRC } from '../shaders/pathFill';
import type { DrawCommand } from '../DrawCommand';

/** A registered paint kind, which no run can carry, so it draws for itself. Tests
 *  that need to break a run use it: every built-in paint kind batches now. */
export const OWN_DRAW_KIND = 'test/own-draw';
export const OWN_DRAW_PROGRAM = 'test/own-draw';

/** Register the kind; returns its disposer. Its paint is the plain path
 *  program drawing transparent, with nothing bound beyond the transforms. */
export function registerOwnDrawPaint(): () => void {
  return registerPaintDrawKind({
    id: OWN_DRAW_KIND,
    programs: { [OWN_DRAW_PROGRAM]: { vert: VERT_SRC, frag: FRAG_SRC } },
    bind: (ctx) => {
      const prog = ctx.program(OWN_DRAW_PROGRAM);
      if (!prog) return null;
      ctx.gl.useProgram(prog.handle);
      ctx.setProjAndModel(prog);
      return prog;
    },
  });
}

/** A 10x10 rect at `x` filled by {@link OWN_DRAW_KIND}. */
export const ownDrawRect = (x: number, y = 0, size = 10): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width: size, height: size },
  fill: { paint: { kind: OWN_DRAW_KIND } },
} as unknown as DrawCommand);
