/**
 * A kit group that paints its box (`data.background`, `data.border`), which a
 * `<g>` cannot: written as a `<g>` marked `data-weasel-group-box` holding the
 * box as a path, then a `<g>` of its content carrying its clip, and read back
 * as that one group.
 */
import type { SvgGroupNode, SvgPathNode } from './types';

/** The attribute marking the `<g>` a group that paints its box is written as. */
export const GROUP_BOX_ATTR = 'data-weasel-group-box';

/** `{ groupBox: true }` where `el` is such a `<g>`, else `{}`. */
export function groupBoxAttrOf(el: Element): { groupBox?: true } {
  return el.tagName.toLowerCase() === 'g' && el.getAttribute(GROUP_BOX_ATTR) === 'true' ? { groupBox: true } : {};
}

const CONTENT_KEYS = new Set(['kind', 'children', 'clip', 'fill', 'stroke', 'inherits']);

/** Whether `g` holds nothing of its own but its children and its clip: the paint it parses with is what it
 *  takes from the group around it. */
const isBareContent = (g: SvgGroupNode): boolean => Object.keys(g).every((k) => CONTENT_KEYS.has(k))
  && (g.fill === undefined || g.inherits?.fill === true) && (g.stroke === undefined || g.inherits?.stroke === true);

/** `g` as the group it was written from, and its box, where it has the shape a painted
 *  group is written in, else `null`: a marked `<g>` something has since edited reads as
 *  the group it now is. */
export function groupBoxParts(g: SvgGroupNode): { group: SvgGroupNode; box: SvgPathNode } | null {
  if (!g.groupBox || g.clip) return null;
  const [box, content, ...rest] = g.children;
  if (rest.length > 0 || box?.kind !== 'path' || content?.kind !== 'group') return null;
  if (!isBareContent(content)) return null;
  const { groupBox: _marked, ...outer } = g;
  return { box, group: { ...outer, children: content.children, ...(content.clip ? { clip: content.clip } : {}) } };
}
