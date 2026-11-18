import { depsUnchanged, type RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ResolvedTheme } from '@weasel-js/theme';
import type { Hud } from './hud';
import type { HudDrawCtx, Widget } from './widget';

/** The HUD layer's `draw`: each widget's content, then every frame, then the focus ring. `ctx`
 *  carries the attachment's theme, font and colors; the canvas size comes with each draw. */
export function createLayerDraw(
  hud: Hud, base: Omit<HudDrawCtx, 'dims'>,
): NonNullable<RenderLayer<unknown>['draw']> {
  const { defaultFont, tokens: theme, color } = base;
  // Keyed weakly, so a widget removed from the HUD takes its entry with it.
  const cache = new WeakMap<Widget, CachedFrame>();

  return (data, view, dims): DrawCommand[] => {
    const ctx = { dims, defaultFont, tokens: theme, color };
    const out: DrawCommand[] = [];
    // Pass 1: interiors. All content precedes all frames so one window's
    // content can never paint over another window's border.
    for (const w of hud.widgets()) {
      if (w.hidden || !w.content || !w.contentRect) continue;
      const rect = w.contentRect;
      if (rect.width <= 0 || rect.height <= 0) continue;
      const children = w.content({
        data, view, dims, rect, defaultFont, tokens: theme, color,
      });
      if (children.length === 0) continue;
      out.push({
        kind: 'group',
        clip: { kind: 'rect', ...rect },
        children,
      });
    }
    // Pass 2: frames.
    const f = hud.focused;
    for (const w of hud.widgets()) {
      if (w.hidden) continue;
      const focus = f !== w ? 0 : hud.focusVisible ? 2 : 1;
      for (const cmd of cachedCommands(cache, w, ctx, focus)) out.push(cmd);
    }
    // Pass 3: the focus ring, over every frame so a neighbor can't hide it.
    if (f && hud.focusVisible && !f.hidden && f.focusRing !== false) out.push(focusRing(f, theme['--wzl-focus-ring']));
    return out;
  };
}

/** `w`'s commands, reused from `cache` while nothing they are drawn from changed. */
function cachedCommands(
  cache: WeakMap<Widget, CachedFrame>, w: Widget, ctx: HudDrawCtx, focus: number,
): DrawCommand[] {
  if (!w.deps) return w.draw(ctx);
  const deps = w.deps(ctx);
  const b = w.bounds;
  const hit = cache.get(w);
  if (hit && hit.focus === focus && hit.tokens === ctx.tokens && hit.font === ctx.defaultFont
    && hit.canvasWidth === ctx.dims.width && hit.canvasHeight === ctx.dims.height
    && hit.x === b.x && hit.y === b.y && hit.width === b.width && hit.height === b.height
    && depsUnchanged(hit.deps, deps)) {
    return hit.cmds;
  }
  const cmds = w.draw(ctx);
  if (!hit) {
    cache.set(w, {
      deps, cmds, focus, tokens: ctx.tokens, font: ctx.defaultFont,
      canvasWidth: ctx.dims.width, canvasHeight: ctx.dims.height, x: b.x, y: b.y, width: b.width, height: b.height,
    });
    return cmds;
  }
  // Refilled in place, so a widget redrawn every frame leaves no entry behind.
  hit.deps = deps; hit.cmds = cmds; hit.focus = focus; hit.tokens = ctx.tokens; hit.font = ctx.defaultFont;
  hit.canvasWidth = ctx.dims.width; hit.canvasHeight = ctx.dims.height; hit.x = b.x; hit.y = b.y; hit.width = b.width; hit.height = b.height;
  return cmds;
}

/** One widget's last frame commands and every input they were built from. */
interface CachedFrame {
  deps: readonly unknown[];
  cmds: DrawCommand[];
  /** 0 unfocused, 1 focused, 2 focused with the ring showing. */
  focus: number;
  tokens: ResolvedTheme;
  font: string;
  canvasWidth: number; canvasHeight: number;
  x: number; y: number; width: number; height: number;
}

const RING_WIDTH = 2;
const RING_GAP = 2;

/** A stroked rect just outside `w`'s bounds, so the ring never covers the
 *  widget's own edge. */
function focusRing(w: Widget, color: string): DrawCommand {
  const { x, y, width: bw, height: h } = w.bounds;
  const out = RING_GAP + RING_WIDTH / 2;
  return {
    kind: 'path',
    path: { kind: 'rect', x: x - out, y: y - out, width: bw + out * 2, height: h + out * 2 },
    stroke: { paint: { kind: 'solid', color }, width: RING_WIDTH },
  };
}
