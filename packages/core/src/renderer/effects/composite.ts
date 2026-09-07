/**
 * The pass that puts a group's finished texture back into its parent, and the
 * shared mechanics every effect pass uses to draw a full-screen quad.
 *
 * Registered as an ordinary program so it compiles through the same
 * `ensureProgram` path a consumer's effect does — one compile path, one place
 * a compile failure is reported.
 */
import { registerProgram } from '../shaders/registerProgram';
import { EFFECT_VERT_SRC, COMPOSITE_FRAG_SRC } from './effectPrelude';

/** Reserved id. The `weasel:` prefix is not enforced anywhere; it is here so a
 *  consumer reading a shader-compile error knows whose program it is. */
export const COMPOSITE_PROGRAM_ID = 'weasel:effect-composite';

registerProgram(COMPOSITE_PROGRAM_ID, EFFECT_VERT_SRC, COMPOSITE_FRAG_SRC);
