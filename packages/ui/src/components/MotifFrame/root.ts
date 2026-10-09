import type { RootProps } from './types';

/** `root` with `className` added — for a motif's own class on the frame's root. */
export function withMotifClass(root: RootProps, className: string): RootProps {
  return { ...root, className: `${root.className} ${className}` };
}
