/**
 * The params this package's actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { ImmediateParams } from '@weasel-js/routing';

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    measure: { angleStep?: number };
    'measure.pickAt': Pick<ImmediateParams, 'press'>;
    'measure.pick': Pick<ImmediateParams, 'affordance'>;
  }
}
