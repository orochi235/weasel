import type { Library } from '@weasel-js/forge';
import './libraries.css';

/** A swatch mixed toward the foreground, as `libraries.css` declares it. */
const tint = (swatch: string): Library['tint'] => ({ ref: `--forge-library-${swatch}` });

/**
 * This repo's libraries, by the package a story file lives in rather than by its title's first segment: the title
 * prefix is authored per story and disagrees with itself, and `packages/ui` alone declares both `Primitives/` and `ui/`.
 */
export const LIBRARIES: readonly Library[] = [
  { path: '/packages/ui/', label: 'ui', tint: tint('amber') },
  { path: '/packages/labkit/', label: 'labkit', tint: tint('teal') },
  { path: '/packages/forge/', label: 'forge', tint: tint('blue') },
  { path: '/packages/diagram/', label: 'diagram', tint: tint('teal') },
  { path: '/apps/draw/', label: 'draw', tint: tint('rose') },
  { path: '/apps/forge/', label: 'forge', tint: tint('blue') },
];
