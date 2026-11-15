/**
 * The params the HUD's actions read, merged into routing's `ActionParamSchema`
 * so their bindings and triggers are typed.
 */
import type { ImmediateParams } from '@weasel-js/core';

/** A HUD point gesture's params: where it landed and the widget hit it pressed. */
export type HudPointParams = Pick<ImmediateParams, 'world' | 'affordance'>;
/** `hud.wheel`'s params: the wheel's canvas-local point, its deltas, and the widget hit under it. */
export type HudWheelParams = Pick<ImmediateParams, 'clientX' | 'clientY' | 'deltaX' | 'deltaY' | 'affordance'>;

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'hud.press': HudPointParams;
    'hud.release': HudPointParams;
    'hud.doubleClick': HudPointParams;
    'hud.contextMenu': HudPointParams;
    'hud.longPress': HudPointParams;
    'hud.wheel': HudWheelParams;
  }
}
