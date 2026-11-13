/**
 * One page of a scene as an SVG document.
 */
import { layoutTextPose } from '@weasel-js/core';
import { serializeSvg, warmSvg, type SerializeOptions, type SvgNode } from '@weasel-js/svg';
import { pageSvgNodes, type PageExportScene, type PageRect, type PageSvgNodesOptions } from './pageNodes';

/** Options for {@link exportPageSvg}. */
export interface ExportPageSvgOptions extends Pick<SerializeOptions, 'title' | 'onWarn' | 'pretty'>, PageSvgNodesOptions {
  /** The color painted under the page. Default none: the page is transparent. */
  background?: string | null;
}

/**
 * Write `page` of `scene` as an SVG document: its `viewBox` is the page rect,
 * its size the page's, the background comes first, and the scene is drawn as
 * the canvas draws it, cut to the page's edges. What lies wholly off the page
 * is left out, and so are annotation layers.
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
  const { background, painters, ...given } = opts;
  const nodes: SvgNode[] = [];
  if (background != null) {
    nodes.push({ kind: 'path', path: { kind: 'rect', x: page.x, y: page.y, width: page.width, height: page.height }, fill: { kind: 'solid', color: background } });
  }
  nodes.push(...pageSvgNodes(scene, page, painters ? { painters } : {}));
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
