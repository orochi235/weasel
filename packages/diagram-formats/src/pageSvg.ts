/**
 * One page of a diagram as an SVG document.
 */
import { layoutTextPose } from '@weasel-js/core';
import { diagramThemeOf } from '@weasel-js/diagram';
import { serializeSvg, warmSvg, type SerializeOptions, type SvgNode } from '@weasel-js/svg';
import { pageSvgNodes, type PageExportScene, type PageRect } from './pageNodes';

/** Options for {@link exportPageSvg}. */
export interface ExportPageSvgOptions extends Pick<SerializeOptions, 'title' | 'onWarn' | 'pretty'> {
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme (`diagram:theme`). `null` paints none. */
  background?: string | null;
}

/** The page color a page export paints when told none: the scene theme's. */
export function pageBackground(scene: PageExportScene, background: string | null | undefined): string | null {
  return background === undefined ? diagramThemeOf(scene).page : background;
}

/**
 * Write `page` of `scene` as an SVG document: its `viewBox` is the page rect,
 * its size the page's, the page color comes first, and the scene is drawn as
 * the canvas draws it, cut to the page's edges. What lies wholly off the page
 * is left out.
 *
 * It waits for the paint kinds and faces the document needs, so its text is
 * written in the lines the canvas lays it out into. A load that fails goes to
 * `onWarn`, and the export goes ahead without it.
 */
export async function exportPageSvg(
  scene: PageExportScene,
  page: PageRect,
  opts: ExportPageSvgOptions = {},
): Promise<string> {
  const { background, ...given } = opts;
  const nodes: SvgNode[] = [];
  const color = pageBackground(scene, background);
  if (color !== null) {
    nodes.push({ kind: 'path', path: { kind: 'rect', x: page.x, y: page.y, width: page.width, height: page.height }, fill: { kind: 'solid', color } });
  }
  nodes.push(...pageSvgNodes(scene, page));
  const serialize: SerializeOptions = {
    ...given,
    viewBox: { x: page.x, y: page.y, width: page.width, height: page.height },
    width: page.width,
    height: page.height,
    textLayout: layoutTextPose,
  };
  try {
    await warmSvg(nodes, serialize);
  } catch (err) {
    serialize.onWarn?.(`a paint kind or font this export uses failed to load: ${String(err)}`);
  }
  return serializeSvg(nodes, serialize);
}
