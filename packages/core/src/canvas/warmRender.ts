/** `warmRender`: load what a synchronous headless render would otherwise draw as nothing. */
import { warmFonts, type FontRequest } from '@weasel-js/font';
import type { DrawCommand } from '@weasel-js/renderer';
import { getImageBitmap, imageLoadsSettled, imageReadsDuring, isPaintKindKnown, warmPaintKinds } from '@weasel-js/renderer';
import { renderNeeds } from './renderNeeds';
import { reportCommandLosses, settleReporting, type RenderDiagnosticSink } from './renderDiagnostics';
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
  /** With `render` or `commands`, hears what they will draw without: a face or paint kind that
   *  failed to load, a kind nothing registered, a picture that did not load,
   *  a shader program with no GLSL. Given it, a failed load is reported here
   *  and does not reject. */
  report?: RenderDiagnosticSink;
}

/**
 * Load everything a synchronous render would otherwise draw as nothing — the
 * lazily registered font atlases, the paint kinds loaded on demand, and the
 * pictures its image nodes and image patterns draw — so that a
 * `renderSceneToPixels` or `RasterSession.render` issued after it resolves is
 * complete.
 *
 * Pass the render (`{ render: args }`) or its commands, and only what they
 * draw with loads: each face their text is set in, through the same
 * resolution the renderer does, and each paint kind they name. A rejection
 * then means something this render needs failed to load. `families` and
 * `paintKinds` replace either derived list. A picture that fails to load does
 * not reject: the image painter draws it as failed. An SVG is waited for at
 * the size the render draws it.
 *
 * With neither `render` nor `commands`, an omitted list loads everything
 * registered: every font family and every kind that has a loader — which
 * fails when any one of them does, and fetches what nothing draws.
 */
export function warmRender<TData, TLayer extends string, TPose>(
  opts: WarmRenderOptions<TData, TLayer, TPose> = {},
): Promise<void> {
  let { families, paintKinds } = opts;
  let images: Promise<void> = Promise.resolve();
  let planned: DrawCommand[] = [];
  let asked: readonly string[] = [];
  if (opts.render || opts.commands) {
    try {
      // Building an image node's commands starts its picture's load.
      if (opts.render) ({ value: planned, srcs: asked } = imageReadsDuring(() => planPixelRender(opts.render!).commands));
    } catch (err) {
      return Promise.reject(err);
    }
    planned = [...planned, ...(opts.commands ?? [])];
    const needs = renderNeeds(planned);
    families ??= needs.fonts;
    // A kind nothing registered draws nothing whether or not this waits.
    paintKinds ??= needs.paintKinds.filter(isPaintKindKnown);
    for (const src of needs.images ?? []) getImageBitmap(src);
    images = settleImages(opts.render);
  }
  const { report } = opts;
  if (!report || (!opts.render && !opts.commands)) return Promise.all([warmFonts(families), warmPaintKinds(paintKinds), images]).then(() => undefined);
  const faces = families ?? [];
  return Promise.all([
    settleReporting(faces, (f) => warmFonts([f]), (f, err) => {
      const family = typeof f === 'string' ? f : f.family;
      return { kind: 'font', subject: family, message: `the font ${family} did not load (${String(err)}); its text is left out` };
    }, report),
    settleReporting(paintKinds ?? [], (k) => warmPaintKinds([k]), (k, err) => (
      { kind: 'paint-kind', subject: k, message: `the paint kind "${k}" did not load (${String(err)}); what it paints is left out` }
    ), report),
    images,
  ]).then(() => reportCommandLosses(planned, asked, report));
}

/** Wait for the loads in flight, then, once a vector picture has decoded, build the render
 *  again so it asks for its raster at the size drawn, and wait for that too. */
async function settleImages<TData, TLayer extends string, TPose>(
  render: RasterRenderArgs<TData, TLayer, TPose> | undefined,
): Promise<void> {
  if (await imageLoadsSettled() === 0 || !render) return;
  planPixelRender(render);
  await imageLoadsSettled();
}
