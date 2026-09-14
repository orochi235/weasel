import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from './definition';
import { derive } from './engine/derive';

const here = dirname(fileURLToPath(import.meta.url));
const weasel: ThemeDefinition = JSON.parse(readFileSync(resolve(here, '../themes/weasel.json'), 'utf8'));

/** The intended token vocabulary. */
const EXPECTED_NAMES = [
  'gray-50', 'gray-100', 'gray-200', 'gray-300', 'gray-400',
  'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900',
  'accent-soft', 'accent-base', 'accent-strong',
  'danger-base', 'warning-base', 'success-base',
  'radius-sm', 'radius-md', 'radius-lg', 'radius-pill', 'border-w', 'line-width', 'curve-width',
  'tb-height', 'control-h', 'glass-blur',
  'slider-track-h', 'slider-thumb-size', 'slider-track-mix', 'slider-thumb-mix', 'field-pad-x',
  'font-size-2xs', 'font-size-xs', 'font-size-sm', 'font-size', 'font-size-lg', 'font-size-xl',
  'space-xs', 'space-sm', 'space-md', 'space-lg',
  'tracking-none', 'tracking-wide', 'tracking-wider',
  'z-toolbar', 'z-overlay', 'z-modal',
  'leading-tight', 'leading-snug', 'leading',
  'backdrop',
  'motion-fast', 'motion-medium',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-out-back',
  'line-subtle', 'line', 'line-strong', 'curve-color',
  'swatch-fuchsia', 'swatch-green', 'swatch-sky', 'swatch-amber', 'swatch-teal',
  'swatch-red', 'swatch-blue', 'swatch-citron', 'swatch-rose', 'swatch-violet',
  'font-ui', 'font-display', 'font-body', 'font-mono',
  'font-weight-light', 'font-weight-normal', 'font-weight-medium', 'font-weight-bold',
  'surface', 'surface-raised', 'surface-sunken',
  'fg', 'fg-muted', 'fg-subtle', 'fg-on-accent',
  'border', 'border-strong',
  'accent', 'accent-fg', 'accent-hover',
  'danger', 'warning', 'success', 'focus-ring', 'glass-tint',
  'fg-inverse', 'surface-hover', 'surface-pressed',
  'shadow',
].sort();

describe('weasel theme definition', () => {
  it('declares exactly the intended token vocabulary', () => {
    expect(Object.keys(derive(weasel, { mode: 'dark' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('declares the same token names in every mode', () => {
    expect(Object.keys(derive(weasel, { mode: 'light' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('derives with no issues in any mode', () => {
    expect(derive(weasel, { mode: 'dark' }).issues).toEqual([]);
    expect(derive(weasel, { mode: 'light' }).issues).toEqual([]);
  });
});
