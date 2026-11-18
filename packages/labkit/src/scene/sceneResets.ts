import { createEmitter, createPart, type Emitter } from '@weasel-js/registry';

/** Fired after `useTrialScene` loads a Reset into `scene` and selects what a fresh one selects, so a canvas
 *  holding it can return its own state to how it opened. */
export const sceneResetsOf: (scene: object) => Emitter = createPart(() => createEmitter());
