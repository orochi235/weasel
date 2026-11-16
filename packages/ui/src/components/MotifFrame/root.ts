import type { ReactNode } from 'react';
import type { HeadingLevel, HeadingParts, RootProps } from './types';

/** `root` with `className` added — for a motif's own class on the frame's root. */
export function withMotifClass(root: RootProps, className: string): RootProps {
  return { ...root, className: `${root.className} ${className}` };
}

/** The heading element for `level`, or for the motif's own default level. */
export function headingTag(level: HeadingLevel | undefined, fallback: HeadingLevel): `h${HeadingLevel}` {
  return `h${level ?? fallback}`;
}

/** The heading's twisty split by `twistyAt`: what a motif draws at the start of its row, and what at the end. */
export function twistySides({ twisty, twistyAt }: Pick<HeadingParts, 'twisty' | 'twistyAt'>): { start: ReactNode; end: ReactNode } {
  return twistyAt === 'end' ? { start: null, end: twisty } : { start: twisty, end: null };
}
