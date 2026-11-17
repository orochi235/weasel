/**
 * One region of a scene as an SVG document, and the `svg` export format.
 */
import type { RenderDiagnosticSink } from '@weasel-js/core';
import { layoutTextPose } from '@weasel-js/text';
import {
  captureExport, exportBackgroundOf, exportReporter, pickExportOptions, regionsOfOne, registerExportFormat,
  type ExportBackground, type ExportFormat, type ExportOptions, type ExportRegion, type ExportRegionSource, type ExportScene,
} from '@weasel-js/export';
import { regionSvgNodes, type RegionSvgNodesOptions } from './regionSvgNodes';
import { serializeSvg } from './serialize';
import type { SerializeOptions, SvgNode } from './types';
import { warmSvg } from './warm';

/** Options for {@link exportRegionSvg}. */
export interface ExportRegionSvgOptions
  extends Pick<SerializeOptions, 'title' | 'pretty' | 'text'>, Pick<RegionSvgNodesOptions, 'painters'>, Pick<ExportOptions, 'onDiagnostic' | 'strict'> {
  /** The color painted under the region, or a function reading it from the document drawn. Default none: the
   *  region is transparent. */
  background?: ExportBackground;
}

/**
 * Write `region` of `scene` as an SVG document: its `viewBox` is the region,
 * its size the region's, the background comes first, and the scene is drawn
 * as the canvas draws it, cut to the region's edges. What lies wholly outside
 * it is left out, and so are annotation layers. Its `<title>` is `title`, else
 * the region's `name`.
 *
 * It waits for the paint kinds and faces the document needs, so its text is
 * written in the lines the canvas lays it out into, and writes one revision
 * of the document: see `captureExport`. What failed to load, and what SVG
 * cannot hold, goes to `onDiagnostic`, and the file is written without it;
 * a `strict` export rejects with `ExportIncompleteError` instead. `text` sets
 * how text is written: live `<text>` (the default), glyph outlines, or live
 * text with its faces embedded.
 */
export async function exportRegionSvg(
  scene: ExportScene,
  region: ExportRegionSource,
  opts: ExportRegionSvgOptions = {},
): Promise<string> {
  const { background, painters, title: given, onDiagnostic, strict, ...rest } = opts;
  const reporter = exportReporter({ ...(onDiagnostic ? { onDiagnostic } : {}), ...(strict !== undefined ? { strict } : {}) });
  const said = (report: RenderDiagnosticSink) => (message: string) => report({ kind: 'unsupported', subject: 'svg', message });
  const nodesOf = (doc: ExportScene, r: ExportRegion, report: RenderDiagnosticSink): SvgNode[] => {
    const { x, y, width, height } = r;
    const nodes: SvgNode[] = [];
    const color = exportBackgroundOf(background, doc);
    if (color !== null) {
      nodes.push({ kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: { kind: 'solid', color } });
    }
    nodes.push(...regionSvgNodes(doc, r, { ...(painters ? { painters } : {}), onWarn: said(report) }));
    return nodes;
  };
  const serializeOf = (r: ExportRegion, report: RenderDiagnosticSink): SerializeOptions => {
    const title = given ?? r.name;
    return {
      ...rest,
      ...(title !== undefined ? { title } : {}),
      viewBox: { x: r.x, y: r.y, width: r.width, height: r.height },
      width: r.width,
      height: r.height,
      textLayout: layoutTextPose,
      onWarn: said(report),
    };
  };
  const svg = await captureExport(scene, regionsOfOne(region), {
    // What these nodes cannot hold is said when `read` writes them.
    warm: (doc, [r], report) => warmSvg(nodesOf(doc, r!, () => {}), serializeOf(r!, report), report),
    read: (doc, [r], report) => serializeSvg(nodesOf(doc, r!, report), serializeOf(r!, report)),
  }, reporter.report);
  reporter.settle();
  return svg;
}

/** What the `svg` format reads beyond the options every format takes. */
export type SvgExportOptions = ExportOptions & Omit<ExportRegionSvgOptions, 'background' | 'onDiagnostic' | 'strict'>;

/** The `svg` format: one region as an SVG document, through {@link exportRegionSvg}. */
export const SVG_EXPORT: ExportFormat<SvgExportOptions> = {
  id: 'svg',
  label: 'SVG Document',
  mimeType: 'image/svg+xml',
  extension: 'svg',
  multiRegion: false,
  options: ['title', 'pretty', 'text', 'painters'],
  async export(scene, regions, opts) {
    const given: ExportRegionSvgOptions = pickExportOptions(SVG_EXPORT, opts);
    const svg = await exportRegionSvg(scene, typeof regions === 'function' ? (doc) => regions(doc)[0]! : regions[0]!, given);
    return new Blob([svg], { type: 'image/svg+xml' });
  },
};

/** Register the `svg` export format with `@weasel-js/export`'s registry. Returns the disposer. */
export function registerSvgExport(): () => void {
  return registerExportFormat(SVG_EXPORT, { fallback: true });
}
