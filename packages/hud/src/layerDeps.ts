import { depsUnchanged } from '@weasel-js/core';
import type { Hud } from './hud';
import type { HudDrawCtx, Widget } from './widget';

/**
 * The HUD layer's `deps`: one array, held for as long as every widget would
 * draw what it drew last frame, so a canvas reuses the layer's commands and,
 * past its retain policy's size, keeps its pixels instead of walking them.
 *
 * Unchanged means the same widgets in the same order, each with the same
 * `hidden`, bounds and `deps`, under the same focus and canvas size; the theme
 * and font are fixed for an attachment. A showing widget that declares no
 * `deps`, or paints `content` from the scene, changes every frame.
 */
export function createLayerDeps(hud: Hud): (ctx: HudDrawCtx) => readonly unknown[] {
  let held: readonly unknown[] = [0];
  // What the last call saw, refilled in place.
  const widgets: Widget[] = [];
  const hidden: boolean[] = [];
  const deps: (readonly unknown[] | undefined)[] = [];
  const bounds: number[] = [];
  let focused: Widget | null = null;
  let focusVisible = false;
  let width = NaN, height = NaN;

  return (ctx) => {
    const list = hud.widgets();
    let same = list.length === widgets.length && hud.focused === focused && hud.focusVisible === focusVisible
      && ctx.dims.width === width && ctx.dims.height === height;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const b = w.bounds;
      if (!w.hidden && (!w.deps || w.content)) same = false;
      const d = w.hidden ? undefined : w.deps?.(ctx);
      const k = i * 4;
      if (same && (w !== widgets[i] || w.hidden !== hidden[i]
        || b.x !== bounds[k] || b.y !== bounds[k + 1] || b.w !== bounds[k + 2] || b.h !== bounds[k + 3]
        || (d !== deps[i] && (d === undefined || deps[i] === undefined || !depsUnchanged(deps[i]!, d))))) {
        same = false;
      }
      widgets[i] = w; hidden[i] = w.hidden; deps[i] = d;
      bounds[k] = b.x; bounds[k + 1] = b.y; bounds[k + 2] = b.w; bounds[k + 3] = b.h;
    }
    widgets.length = hidden.length = deps.length = list.length;
    bounds.length = list.length * 4;
    focused = hud.focused; focusVisible = hud.focusVisible;
    width = ctx.dims.width; height = ctx.dims.height;
    if (!same) held = [(held[0] as number) + 1];
    return held;
  };
}
