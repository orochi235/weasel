import type { HeadingLevel, RootProps } from './types';

/** `root` with `className` added — for a motif's own class on the frame's root. */
export function withMotifClass(root: RootProps, className: string): RootProps {
  return { ...root, className: `${root.className} ${className}` };
}

/** The heading element for `level`, or for the motif's own default level. */
export function headingTag(level: HeadingLevel | undefined, fallback: HeadingLevel): `h${HeadingLevel}` {
  return `h${level ?? fallback}`;
}
