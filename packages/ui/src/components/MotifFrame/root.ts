import { EMPHASIS_FG, type Emphasis } from '@weasel-js/theme';
import type { CSSProperties, ReactNode } from 'react';
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

/** Whether React draws anything for `node`: `null`, `undefined`, booleans and `''` draw nothing, as `cond && <X/>` gives. */
export function drawn(node: ReactNode): boolean {
  return node != null && typeof node !== 'boolean' && node !== '';
}

/** Whether a frame's heading row has anything to draw: an untitled frame with no controls draws none. */
export function headed({ title, inline, twisty, leading, actions }: HeadingParts): boolean {
  return [title, inline, twisty, leading, actions].some(drawn);
}

/** The frame's own emphasis resolved again, for an element under its root that redraws the theme's colors. */
export function emphasisStyle(root: RootProps): CSSProperties | undefined {
  const emphasis = root['data-emphasis'];
  if (emphasis === undefined || !Object.hasOwn(EMPHASIS_FG, emphasis)) return undefined;
  return { '--wzl-emphasis-fg': EMPHASIS_FG[emphasis as Emphasis] } as CSSProperties;
}
