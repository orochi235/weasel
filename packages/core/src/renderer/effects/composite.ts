/**
 * The pass that puts a group's finished texture back into its parent, and the
 * shared mechanics every effect pass uses to draw a full-screen quad.
 *
 * Registered as an ordinary program so it compiles through the same
 * `ensureProgram` path a consumer's effect does — one compile path, one place
 * a compile failure is reported.
 */
import { getProgramSource, registerProgram } from '../shaders/registerProgram';
import { EFFECT_VERT_SRC, COMPOSITE_FRAG_SRC } from './effectPrelude';

/** Reserved id. The `weasel:` prefix is not enforced anywhere; it is here so a
 *  consumer reading a shader-compile error knows whose program it is. */
export const COMPOSITE_PROGRAM_ID = 'weasel:effect-composite';

/**
 * The composite program's id, registering the program on first ask. Not done
 * at module load: a bundler may drop an import kept only for its side effect.
 */
export function compositeProgramId(): string {
  if (!getProgramSource(COMPOSITE_PROGRAM_ID)) {
    registerProgram(COMPOSITE_PROGRAM_ID, EFFECT_VERT_SRC, COMPOSITE_FRAG_SRC);
  }
  return COMPOSITE_PROGRAM_ID;
}
