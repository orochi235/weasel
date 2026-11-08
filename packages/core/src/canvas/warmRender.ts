/** `warmRender`: load what a synchronous headless render would otherwise draw as nothing. */
import { warmFonts, type FontRequest } from '@weasel-js/font';
import type { DrawCommand } from '@weasel-js/renderer';
import { isPaintKindKnown, warmPaintKinds } from '@weasel-js/renderer';
import { renderNeeds } from './renderNeeds';
import { planPixelRender, type RasterRenderArgs } from './renderSceneToPixels';

/** What {@link warmRender} loads. */
export interface WarmRenderOptions<TData = unknown, TLayer extends string = string, TPose = unknown> {
  /** The render about to happen, as `renderSceneToPixels` or
   *  `RasterSession.render` will take it. Its commands are built the way the
   *  render builds them, and only the faces and paint kinds they draw with
   *  load. */
  render?: RasterRenderArgs<TData, TLayer, TPose>;
  /** Commands about to be drawn, read the same way as `render`'s. Both may be
   *  given; what either needs loads. */
  commands?: readonly DrawCommand[];
  /** Fonts to load in place of the ones derived — family names or single
   *  variants, as `warmFonts` takes them. */
  families?: readonly (string | FontRequest)[];
  /** Paint kinds to load in place of the ones derived, as `warmPaintKinds`
   *  takes them. */
  paintKinds?: readonly string[];
}

/**
 * Load everything a synchronous render would otherwise draw as nothing — the
 * lazily registered font atlases and the paint kinds loaded on demand — so
 * that a `renderSceneToPixels` or `RasterSession.render` issued after it
 * resolves is complete.
 *
 * Pass the render (`{ render: args }`) or its commands, and only what they
 * draw with loads: each face their text is set in, through the same
 * resolution the renderer does, and each paint kind they name. A rejection
 * then means something this render needs failed to load. `families` and
 * `paintKinds` replace either derived list.
 *
 * With neither `render` nor `commands`, an omitted list loads everything
 * registered: every font family and every kind that has a loader — which
 * fails when any one of them does, and fetches what nothing draws.
 */
export function warmRender<TData, TLayer extends string, TPose>(
  opts: WarmRenderOptions<TData, TLayer, TPose> = {},
): Promise<void> {
  let { families, paintKinds } = opts;
  if (opts.render || opts.commands) {
    let planned: DrawCommand[];
    try {
      planned = opts.render ? planPixelRender(opts.render).commands : [];
    } catch (err) {
      return Promise.reject(err);
    }
    const needs = renderNeeds([...planned, ...(opts.commands ?? [])]);
    families ??= needs.fonts;
    // A kind nothing registered draws nothing whether or not this waits.
    paintKinds ??= needs.paintKinds.filter(isPaintKindKnown);
  }
  return Promise.all([warmFonts(families), warmPaintKinds(paintKinds)]).then(() => undefined);
}
