/** Which of a data item's own colors `diagramScene` lists in its trait's `ownStyle`. */
import type { EdgeStyle, NodeStyle } from './dataTypes';
import type { StyleField } from './theme/styleField';

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
  for (const [k, v] of Object.entries(colors)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
