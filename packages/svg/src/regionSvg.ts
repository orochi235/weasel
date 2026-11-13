/**
 * One region of a scene as an SVG document, and the `svg` export format.
 */
import { layoutTextPose, registerExportFormat, type ExportFormat, type ExportOptions, type ExportRegion, type ExportScene } from '@weasel-js/core';
import { regionSvgNodes, type RegionSvgNodesOptions } from './regionSvgNodes';
import { serializeSvg } from './serialize';
import type { SerializeOptions, SvgNode } from './types';
import { warmSvg } from './warm';

/** Options for {@link exportRegionSvg}. */
export interface ExportRegionSvgOptions extends Pick<SerializeOptions, 'title' | 'onWarn' | 'pretty' | 'text'>, RegionSvgNodesOptions {
  /** The color painted under the region. Default none: the region is transparent. */
  background?: string | null;
}

/**
 * Write `region` of `scene` as an SVG document: its `viewBox` is the region,
 * its size the region's, the background comes first, and the scene is drawn
 * as the canvas draws it, cut to the region's edges. What lies wholly outside
 * it is left out, and so are annotation layers. Its `<title>` is `title`, else
 * the region's `name`.
 *
 * It waits for the paint kinds and faces the document needs, so its text is
 * written in the lines the canvas lays it out into. A load that fails goes to
 * `onWarn`, and the export goes ahead without it. `text` sets how text is
 * written: live `<text>` (the default), glyph outlines, or live text with its
 * faces embedded.
 */
export async function exportRegionSvg(
  scene: ExportScene,
  region: ExportRegion,
  opts: ExportRegionSvgOptions = {},
): Promise<string> {
  const { background, painters, title = region.name, ...given } = opts;
  const { x, y, width, height } = region;
  const nodes: SvgNode[] = [];
  if (background != null) {
    nodes.push({ kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: { kind: 'solid', color: background } });
  }
  nodes.push(...regionSvgNodes(scene, region, painters ? { painters } : {}));
  const serialize: SerializeOptions = {
    ...given,
    ...(title !== undefined ? { title } : {}),
    viewBox: { x, y, width, height },
    width,
    height,
    textLayout: layoutTextPose,
  };
  try {
    await warmSvg(nodes, serialize);
  } catch (err) {
    serialize.onWarn?.(`a paint kind or font this export uses failed to load: ${String(err)}`);
  }
  return serializeSvg(nodes, serialize);
}

/** What the `svg` format reads beyond the options every format takes. */
export type SvgExportOptions = ExportOptions & Omit<ExportRegionSvgOptions, 'background' | 'onWarn'>;

/** The `svg` format: one region as an SVG document, through {@link exportRegionSvg}. */
export const SVG_EXPORT: ExportFormat<SvgExportOptions> = {
  id: 'svg',
  label: 'SVG Document',
  mimeType: 'image/svg+xml',
  extension: 'svg',
  multiRegion: false,
  async export(scene, regions, { background, onWarn, title, pretty, text, painters }) {
    const picked = { background, onWarn, title, pretty, text, painters };
    const given = Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== undefined)) as ExportRegionSvgOptions;
    const svg = await exportRegionSvg(scene, regions[0]!, given);
    return new Blob([svg], { type: 'image/svg+xml' });
  },
};

/** Register the `svg` export format with core's export registry. Returns the disposer. */
export function registerSvgExport(): () => void {
  return registerExportFormat(SVG_EXPORT);
}
