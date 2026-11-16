/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { ImmediateParams } from '@weasel-js/routing';

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    editTextAt: Pick<ImmediateParams, 'world'>;
    editEffectText: Pick<ImmediateParams, 'world'>;
  }
}

export {};
