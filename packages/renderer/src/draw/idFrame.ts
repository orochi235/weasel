/**
 * What a frame drawn by `WeaselRenderer.renderIds` carries beside its color:
 * which id each draw writes.
 */
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { ID_UNIFORM, NO_PICK_ID, checkPickId, idChannels } from '../shaders/idOutput';
import type { DrawContext } from './drawContext';

/** An id frame's state, on `DrawContext.ids` while it draws. */
export interface IdFrame {
  /** The least alpha a fragment claims its pixel with. */
  readonly minAlpha: number;
  /** The program a group's ids composite with. */
  readonly composite: ShaderProgram;
}

/**
 * Whether the next draw with `program` writes its id, and if so, give the
 * program that id. Paint that carries no id, or a program that writes none,
 * leaves the ids beneath it as they were.
 */
export function idDrawn(ctx: DrawContext, ids: IdFrame, program: ShaderProgram): boolean {
  const id = ctx.state.pickId;
  if (id === NO_PICK_ID || !program.writesIds) return false;
  checkPickId(id);
  const [r, g, b] = idChannels(id);
  program.set4f(ID_UNIFORM, r, g, b, ids.minAlpha);
  return true;
}
