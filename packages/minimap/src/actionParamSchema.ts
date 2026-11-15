/**
 * The params the minimap's actions read, merged into routing's
 * `ActionParamSchema` so their bindings and triggers are typed.
 */
import type { ImmediateParams } from '@weasel-js/routing';

/** `minimap.zoom`'s params: the world point under the cursor, and a wheel's delta or a pinch's scale. */
export type MinimapZoomParams = Pick<ImmediateParams, 'world' | 'deltaY' | 'scale'>;

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'minimap.center': Pick<ImmediateParams, 'world'>;
    'minimap.zoom': MinimapZoomParams;
  }
}
