import { isValidElement, type ReactNode } from 'react';

/** The text a React node renders: its strings, numbers and bigints, through elements' children and any iterable, in
 *  order. A label measured for layout is read this way. */
export function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  if (isIterable(node)) return Array.from(node, nodeText).join('');
  return '';
}

const isIterable = (node: unknown): node is Iterable<ReactNode> =>
  typeof node === 'object' && node !== null && typeof (node as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
