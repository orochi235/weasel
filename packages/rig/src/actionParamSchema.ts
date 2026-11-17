/**
 * The params the rig tools' actions read, merged into routing's
 * `ActionParamSchema` so their bindings, triggers, and tunings are typed.
 */
import type { ImmediateParams } from '@weasel-js/routing';

/** The weight brush's params: its radius in screen px. */
export type WeightBrushParams = { radiusPx?: number };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'bone.pick': Pick<ImmediateParams, 'press'>;
    'weight.paint': WeightBrushParams;
    'weight.dab': WeightBrushParams & Pick<ImmediateParams, 'press' | 'mods'>;
  }
}
