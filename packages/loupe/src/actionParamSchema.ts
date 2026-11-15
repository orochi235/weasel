/**
 * The params the loupe's actions read, merged into routing's `ActionParamSchema`
 * so their bindings and triggers are typed.
 */
import type { ImmediateParams } from '@weasel-js/routing';

/** `loupe.aim`'s params: the hover's client point, and whether a button is down. */
export type LoupeAimParams = Pick<ImmediateParams, 'clientX' | 'clientY' | 'held'>;

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'loupe.aim': LoupeAimParams;
    'loupe.magnify': Pick<ImmediateParams, 'deltaY'>;
  }
}
