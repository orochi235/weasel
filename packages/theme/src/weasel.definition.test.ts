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
  'secondary-soft', 'secondary-base', 'secondary-strong',
  'danger-base', 'warning-base', 'success-base',
  'radius-sm', 'radius-md', 'radius-lg', 'radius-pill', 'border-w', 'line-width', 'curve-width',
  'tb-height', 'control-h-xs', 'control-h-sm', 'control-h', 'icon-button-size', 'glass-blur',
  'slider-track-h', 'slider-thumb-size', 'slider-track-mix', 'slider-thumb-mix', 'field-pad-x',
  'handle-size', 'handle-size-sm', 'handle-size-lg',
  'checker-a', 'checker-b', 'checker-size', 'workspace-surface', 'workspace-line',
  'font-size-2xs', 'font-size-xs', 'font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl', 'font-size',
  'space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-7', 'space-8',
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
  'secondary', 'secondary-fg',
  'danger', 'warning', 'success', 'focus-ring', 'glass-tint',
  'fg-inverse', 'surface-hover', 'surface-pressed',
  'shadow',
  'panel-surface', 'panel-border-color', 'panel-border-style', 'panel-border-width',
  'panel-radius', 'panel-pad', 'panel-blur', 'panel-tone-mix', 'panel-title-font',
  'panel-title-weight', 'panel-title-size', 'panel-title-case', 'panel-title-tracking',
  'panel-title-color', 'panel-title-inset', 'stance-scope-border-width', 'stance-scope-radius',
  'stance-scope-tone-mix', 'stance-scope-nested-radius', 'stance-scope-nested-surface',
  'stance-aside-surface', 'stance-aside-border-color', 'stance-aside-blur', 'stance-aside-title-color',
  'stance-advanced-title-color', 'stance-debug-border-style', 'stance-debug-title-font',
  'stance-debug-title-case', 'stance-danger-tone', 'stance-danger-border-color',
  'stance-danger-title-color', 'stance-notice-tone', 'stance-notice-tone-mix',
  'stance-important-border-color', 'stance-important-title-color', 'stance-preview-pad',
  'stance-preview-title-size', 'stance-preview-title-case', 'stance-preview-title-inset',
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

  it('derives with no issues at every density', () => {
    for (const density of ['compact', 'comfortable', 'roomy']) {
      expect(derive(weasel, { mode: 'dark', density }).issues).toEqual([]);
    }
  });

  // Every rung distinct at every density: the factors are close enough at the small
  // end that a smaller base rounds two of them onto the same pixel.
  it('keeps every rank of the type ramp distinct at every density', () => {
    for (const density of ['compact', 'comfortable', 'roomy']) {
      const tokens = derive(weasel, { mode: 'dark', density }).tokens;
      const ranks = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'].map((r) => tokens[`font-size-${r}`].value);
      expect(new Set(ranks).size).toBe(ranks.length);
    }
  });
});
