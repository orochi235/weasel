/** Which of a data item's own colors `diagramScene` lists in its trait's `ownStyle`. */
import type { Row } from './body';
import type { EdgeStyle, NodeStyle } from './dataTypes';
import type { StyleField } from './theme/styleField';
import type { DiagramNode } from './types';

const NODE_FIELDS: readonly StyleField[] = ['fill', 'stroke', 'text'];

/** The `ownStyle` a node, container, or lane given `colors` carries: `{}` when it sets no color. */
export function ownNodeStyle(colors: Partial<NodeStyle> | undefined): { ownStyle?: StyleField[] } {
  const own = NODE_FIELDS.filter((f) => colors?.[f] !== undefined);
  return own.length > 0 ? { ownStyle: own } : {};
}

/** The `ownStyle` an edge given `colors` carries: its stroke as `stroke`, its label as `text`. */
export function ownEdgeStyle(colors: Partial<EdgeStyle> | undefined): { ownStyle?: StyleField[] } {
  const own: StyleField[] = [];
  if (colors?.stroke !== undefined) own.push('stroke');
  if (colors?.label !== undefined) own.push('text');
  return own.length > 0 ? { ownStyle: own } : {};
}

/** `style` with every color `colors` sets over it. */
export function withColors<T extends object>(style: T, colors: Partial<T> | undefined): T {
  if (colors === undefined) return style;
  const out = { ...style };
  for (const [k, v] of Object.entries(colors)) {
    // Defined, not assigned, so a `__proto__` key read from JSON stays a key.
    if (v !== undefined) Object.defineProperty(out, k, { value: v, writable: true, enumerable: true, configurable: true });
  }
  return out;
}

/** The color a body row's text is drawn in under `style`: a header's against its band. */
export const rowTextColor = (row: Row | undefined, style: NodeStyle): string =>
  row?.kind === 'header' ? style.headerText ?? style.fill : style.text;

/** How opaque a header's `aside` is drawn, in its title's color. */
export const HEADER_ASIDE_OPACITY = 0.7;

/** A header's `aside` text's fill under `style`. */
export const asideFillOf = (style: NodeStyle): { paint: { color: string; opacity: number } } =>
  ({ paint: { color: rowTextColor({ kind: 'header', text: '' }, style), opacity: HEADER_ASIDE_OPACITY } });

/** The `headerFill` a body's data carries: none unless it has a header and `style` names its band. */
export const headerFillOf = (trait: DiagramNode, style: NodeStyle): { headerFill?: { paint: { color: string } } } =>
  trait.header !== undefined && style.header !== undefined ? { headerFill: { paint: { color: style.header } } } : {};
