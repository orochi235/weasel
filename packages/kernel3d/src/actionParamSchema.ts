/**
 * The params kernel3d's actions read, merged into routing's `ActionParamSchema`
 * so their bindings and triggers are typed.
 */
import type { ImmediateParams } from '@weasel-js/routing';

/** `camera.dolly`'s params: a wheel's delta and canvas-local point, or a pinch's scale. */
export type DollyParams = Pick<ImmediateParams, 'deltaY' | 'scale' | 'clientX' | 'clientY'>;

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'camera.dolly': DollyParams;
  }
}
