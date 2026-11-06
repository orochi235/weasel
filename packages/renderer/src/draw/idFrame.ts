/**
 * What a frame drawn by `WeaselRenderer.renderIds` carries beside its color:
 * which id each draw writes, and which buffers have an id attachment.
 */
import { PROGRAMS_WITHOUT_IDS, PROGRAMS_WRITING_OWN_IDS, type ShaderProgram } from '../shaders/ShaderProgram';
import { ID_ATTRIBUTE_LOCATION, NO_PICK_ID, checkPickId, idChannels } from '../shaders/idOutput';
import type { DrawContext } from './drawContext';

/** An id frame's state, on `DrawContext.ids` while it draws. */
export interface IdFrame {
  /** The least alpha a fragment claims its pixel with. */
  readonly minAlpha: number;
  /** Framebuffers holding an id attachment at `COLOR_ATTACHMENT1`. */
  readonly targets: WeakSet<WebGLFramebuffer>;
  /** The id the attribute holds now; -1 before the first draw sets it. */
  lastId: number;
  /** The program a group's ids composite with. */
  readonly composite: ShaderProgram;
}

/** Both attachments drawn: what an id frame's buffers draw with. */
export function drawBoth(gl: WebGL2RenderingContext): void {
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
}

/**
 * Set up the next draw for an id frame: the attribute to the id drawing now,
 * and attachment 1 switched off for a program that writes no id there or for
 * paint that carries none. Returns whether it was, so the caller switches it
 * back after the draw.
 */
export function prepareIdDraw(ctx: DrawContext, ids: IdFrame): boolean {
  const gl = ctx.gl;
  const id = ctx.state.pickId;
  const claims = id !== NO_PICK_ID;
  if (claims && id !== ids.lastId) {
    checkPickId(id);
    const [r, g, b] = idChannels(id);
    gl.vertexAttrib4f(ID_ATTRIBUTE_LOCATION, r, g, b, ids.minAlpha);
    ids.lastId = id;
  }
  const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
  if (!program || PROGRAMS_WRITING_OWN_IDS.has(program)) return false;
  if (claims && !PROGRAMS_WITHOUT_IDS.has(program)) return false;
  const fbo = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  if (!fbo || !ids.targets.has(fbo)) return false;
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
  return true;
}
