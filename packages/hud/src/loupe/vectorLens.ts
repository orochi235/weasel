import {
  createViewportLayer, viewScreenToWorld,
  type CanvasViewHandle, type RenderLayer, type SceneCanvasApi, type View, type ViewAt,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { loupeInnerView } from '@weasel-js/loupe';
import type { WindowWidget } from '../widgets/window/window';
import type { HudContentCtx, WidgetBounds } from '../widget';

/** The canvas a lens can be a view on. */
export type LensHost = Pick<SceneCanvasApi, 'addView' | 'getSurfaceRect'> & Partial<Pick<SceneCanvasApi, 'getPaintedVersion' | 'viewAt'>>;

/** The id the lens's view takes on its canvas. */
const LENS_VIEW = 'weasel-loupe:lens';

/** Where an interactive lens routes while its window is hidden: nowhere. */
const NO_RECT = { x: 0, y: 0, width: 0, height: 0 };

/** The lens camera aimed at `aim`: magnifying the view under it, or the
 *  canvas's own camera `outer` where no view is. */
function lensCamera(
  aim: { x: number; y: number }, under: ViewAt | null, outer: View, rect: WidgetBounds, factor: number,
): View {
  if (under && under.id !== null) {
    const world = viewScreenToWorld(under.view, { x: aim.x - under.rect.x, y: aim.y - under.rect.y });
    return loupeInnerView(world, under.view, rect, factor);
  }
  return loupeInnerView(viewScreenToWorld(outer, aim), outer, rect, factor);
}

/** What a vector-mode lens shows: the canvas's layers drawn again through a magnified camera. */
export interface VectorLens {
  /** The view under the aim, the lens's own aside; null where none is or the host cannot say. */
  aimedView(): ViewAt | null;
  /** The lens interior. */
  draw(ctx: HudContentCtx): DrawCommand[];
  /** Takes the lens's view off its canvas. */
  remove(): void;
}

/** How a vector lens is set up; read once, as it is made. */
export interface VectorLensSetup {
  /** The canvas the lens becomes a view on; without one it draws `source` itself. */
  host: LensHost | undefined;
  source: RenderLayer<unknown>[] | undefined;
  interactive: boolean;
  win: WindowWidget;
  aim: () => { x: number; y: number };
  factor: () => number;
  /** The color behind the magnified content, and the command painting it. */
  background: (ctx: HudContentCtx) => string;
  backdrop: (ctx: HudContentCtx) => DrawCommand;
}

export function createVectorLens(setup: VectorLensSetup): VectorLens {
  const { host, source, interactive, win, aim, factor, background, backdrop } = setup;
  const aimedView = () => host?.viewAt?.(aim(), { except: LENS_VIEW }) ?? null;
  const innerView = (outer: View, rect: WidgetBounds): View => lensCamera(aim(), aimedView(), outer, rect, factor());

  let lens: CanvasViewHandle | null = host ? host.addView({
    id: LENS_VIEW,
    label: 'Loupe',
    bounds: () => (win.hidden ? NO_RECT : win.contentRect),
    view: (outer) => innerView(outer, win.contentRect),
    paint: false,
    interactive,
    follows: () => aimedView()?.id ?? null,
    ...(source ? { layers: () => source } : {}),
  }) : null;

  return {
    aimedView,
    draw(ctx) {
      if (host) return lens ? [backdrop(ctx), ...lens.draw(ctx.data, ctx.view, ctx.dims)] : [backdrop(ctx)];
      // A fresh lens per frame: CreateViewportLayerOptions.view is static, and the
      // inner view moves with the pointer.
      const picture = createViewportLayer<unknown>({
        id: `${win.id}:lens`,
        label: 'Loupe content',
        source: source ?? [],
        view: innerView(ctx.view, ctx.rect),
        bounds: () => ctx.rect,
        background: background(ctx),
      });
      return picture.draw(ctx.data, ctx.view, ctx.dims);
    },
    remove() {
      lens?.remove();
      lens = null;
    },
  };
}
