import { isValidElement, type ReactNode } from 'react';

/** The text a React node renders: its strings and numbers, through elements' children, in order. A label measured
 *  for layout is read this way. */
export function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}
