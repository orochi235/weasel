import type { Library } from '@weasel-js/forge';
import './libraries.css';

/** A swatch mixed toward the foreground, as `libraries.css` declares it. */
const tone = (swatch: string): Library['tone'] => ({ ref: `--forge-library-${swatch}` });

/**
 * This repo's libraries, by the package a story file lives in rather than by its title's first segment: the title
 * prefix is authored per story and disagrees with itself, and `packages/ui` alone declares both `Primitives/` and `ui/`.
 */
export const LIBRARIES: readonly Library[] = [
  { path: '/packages/ui/', label: 'ui', tone: tone('amber') },
  { path: '/packages/labkit/', label: 'labkit', tone: tone('teal') },
  { path: '/packages/forge/', label: 'forge', tone: tone('blue') },
  { path: '/apps/draw/', label: 'draw', tone: tone('rose') },
  { path: '/apps/forge/', label: 'forge', tone: tone('blue') },
];
