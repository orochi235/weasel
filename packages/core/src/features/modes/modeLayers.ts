import type { Rect } from '@weasel-js/geom';
import type { ModeDecorations, ModeRegistry } from '@weasel-js/modes';
import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';

/** Options for {@link workspaceTintLayer}. */
export interface WorkspaceTintLayerOptions {
  registry: ModeRegistry;
  /** The page, in world coordinates. When given, the tint covers only the
   *  workspace around it, each strip fading toward the page edge if the mode
   *  names a gradient. Without it the tint covers the whole canvas. */
  page?: () => Rect | null;
  /** Opacity for every mode's tint, in place of its `workspace.intensity`. */
  intensity?: number;
  id?: string;
  label?: string;
}

const DEFAULT_INTENSITY = 0.12;

/**
 * A screen-space layer painting the active mode's `WorkspaceVisual`: nothing in
 * a mode without a tint, otherwise a wash at the mode's intensity, bottom-up or
 * top-down when the mode names a gradient. It subscribes to the registry, so a
 * mode switch repaints it.
 */
export function workspaceTintLayer(opts: WorkspaceTintLayerOptions): RenderLayer<unknown> {
  const { registry } = opts;
  return {
    id: opts.id ?? 'mode-tint',
    label: opts.label ?? 'Mode tint',
    space: 'screen',
    subscribe: registry.subscribe,
    draw: (_data, view, dims) => {
      const ws = registry.current().workspace;
      const tint = ws?.tint;
      if (!tint || tint === 'transparent') return [];
      const opacity = opts.intensity ?? ws.intensity ?? DEFAULT_INTENSITY;
      const { width: W, height: H } = dims;

      const strip = (
        x: number, y: number, width: number, height: number,
        from: { x: number; y: number }, to: { x: number; y: number },
      ): DrawCommand => ({
        kind: 'path',
        path: { kind: 'rect', x, y, width, height },
        fill: ws.gradient
          ? { fill: 'linear-gradient', from, to, stops: [{ offset: 0, color: tint }, { offset: 1, color: 'transparent' }], opacity }
          : { fill: 'solid', color: tint, opacity },
      });

      const whole = (): DrawCommand[] => [
        ws.gradient === 'top-down'
          ? strip(0, 0, W, H, { x: 0, y: 0 }, { x: 0, y: H })
          : strip(0, 0, W, H, { x: 0, y: H }, { x: 0, y: 0 }),
      ];

      const page = opts.page?.();
      if (!page) return whole();

      const t = viewToTransform(view);
      const [sx0, sy0] = worldToScreen(page.x, page.y, t);
      const [sx1, sy1] = worldToScreen(page.x + page.width, page.y + page.height, t);
      const pl = Math.max(0, Math.min(sx0, sx1));
      const pt = Math.max(0, Math.min(sy0, sy1));
      const pr = Math.min(W, Math.max(sx0, sx1));
      const pb = Math.min(H, Math.max(sy0, sy1));
      if (pr <= pl || pb <= pt) {
        return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { fill: 'solid', color: tint, opacity } }];
      }

      const cmds: DrawCommand[] = [];
      const push = (
        x: number, y: number, w: number, h: number,
        from: { x: number; y: number }, to: { x: number; y: number },
      ): void => { if (w > 0 && h > 0) cmds.push(strip(x, y, w, h, from, to)); };
      push(0, 0, W, pt, { x: 0, y: 0 }, { x: 0, y: pt });
      push(0, pb, W, H - pb, { x: 0, y: H }, { x: 0, y: pb });
      push(0, pt, pl, pb - pt, { x: 0, y: 0 }, { x: pl, y: 0 });
      push(pr, pt, W - pr, pb - pt, { x: W, y: 0 }, { x: pr, y: 0 });
      return cmds;
    },
  };
}

/** A world-space layer drawing a `ModeDecorations`' active painter. It
 *  subscribes to the decorations, so a mode switch or a new painter repaints
 *  it. */
export function modeDecorationLayer(
  decorations: ModeDecorations,
  opts: { id?: string; label?: string } = {},
): RenderLayer<unknown> {
  return {
    id: opts.id ?? 'mode-decorations',
    label: opts.label ?? 'Mode decorations',
    subscribe: decorations.subscribe,
    draw: () => decorations.paint() as DrawCommand[],
  };
}
