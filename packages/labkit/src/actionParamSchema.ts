/**
 * The params labkit's actions read, merged into routing's `ActionParamSchema`
 * so their bindings and triggers are typed.
 */
import type { ImmediateParams } from '@weasel-js/routing';

/** `lab.zoom`'s params: which way the focused trial's camera zooms. */
export type LabZoomParams = { kind?: 'in' | 'out' | 'reset' };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'lab.zoom': LabZoomParams;
    'camera.tap': Pick<ImmediateParams, 'world'>;
    'loupe.follow': Pick<ImmediateParams, 'clientX' | 'clientY'>;
  }
}
