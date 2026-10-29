import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from './definition';
import { derive } from './engine/derive';
import { toHex, toLch } from './engine/color/oklch';

const here = dirname(fileURLToPath(import.meta.url));
const weasel: ThemeDefinition = JSON.parse(readFileSync(resolve(here, '../themes/weasel.json'), 'utf8'));

/** The intended token vocabulary. */
const EXPECTED_NAMES = [
  'gray-50', 'gray-100', 'gray-200', 'gray-300', 'gray-400',
  'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900',
  'accent-soft', 'accent-base', 'accent-strong',
  'secondary-soft', 'secondary-base', 'secondary-strong',
  'danger-base', 'warning-base', 'success-base', 'info-base',
  'radius-sm', 'radius-md', 'radius-lg', 'radius-pill', 'border-w', 'line-width', 'curve-width',
  'tb-height', 'control-h-xs', 'control-h-sm', 'control-h', 'icon-button-size', 'gloss', 'glass-blur',
  'slider-track-h', 'slider-thumb-size', 'slider-track-slop', 'slider-thumb-slop', 'slider-track-mix', 'slider-thumb-mix', 'field-pad-x',
  'handle-size', 'handle-size-sm', 'handle-size-lg', 'handle-dot-size', 'handle-dot-size-sm',
  'checker-a', 'checker-b', 'checker-size', 'workspace-surface', 'workspace-line', 'workspace',
  'font-size-2xs', 'font-size-xs', 'font-size-sm', 'font-size-md', 'font-size-lg', 'font-size-xl', 'font-size',
  'space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-7', 'space-8',
  'space-xs', 'space-sm', 'space-md', 'space-lg',
  'tracking-none', 'tracking-wide', 'tracking-wider',
  'z-toolbar', 'z-overlay', 'z-hud', 'z-modal', 'z-toast', 'z-popover', 'z-drag',
  'leading-tight', 'leading-snug', 'leading',
  'backdrop',
  'motion-fast', 'motion-medium',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-out-back',
  'line-subtle', 'line', 'line-strong', 'curve-color',
  'swatch-fuchsia', 'swatch-green', 'swatch-sky', 'swatch-amber', 'swatch-teal',
  'swatch-red', 'swatch-blue', 'swatch-citron', 'swatch-rose', 'swatch-violet',
  'font-ui', 'font-numeric', 'font-display', 'font-body', 'font-mono',
  'font-weight-light', 'font-weight-normal', 'font-weight-medium', 'font-weight-bold',
  'surface', 'surface-raised', 'surface-sunken', 'surface-popover',
  'fg', 'fg-muted', 'fg-subtle', 'fg-on-accent', 'fg-muted-on-accent', 'fg-subtle-on-accent',
  'border', 'border-strong', 'border-on-sunken',
  'code-keyword', 'code-string', 'code-number', 'code-constant', 'code-property', 'code-name',
  'accent', 'accent-fg', 'accent-hover',
  'secondary', 'secondary-fg',
  'danger', 'warning', 'success', 'info', 'focus-ring', 'glass-tint',
  'fg-inverse', 'surface-hover', 'surface-pressed',
  'shadow', 'scrim',
  'panel-surface', 'panel-border-color', 'panel-border-style', 'panel-border-width',
  'panel-radius', 'panel-pad', 'panel-blur', 'panel-tint-mix', 'panel-title-font',
  'panel-title-weight', 'panel-title-size', 'panel-title-case', 'panel-title-tracking',
  'panel-title-color', 'panel-title-inset', 'stance-clarify-border-width', 'stance-clarify-radius',
  'stance-clarify-tint-mix', 'stance-clarify-nested-radius', 'stance-clarify-nested-surface',
  'stance-aside-surface', 'stance-aside-border-color', 'stance-aside-blur', 'stance-aside-title-color',
  'stance-advanced-title-color', 'stance-debug-border-style', 'stance-debug-title-font',
  'stance-debug-title-case', 'stance-preview-pad',
  'stance-preview-title-size', 'stance-preview-title-case', 'stance-preview-title-inset',
].sort();

describe('weasel theme definition', () => {
  it('declares exactly the intended token vocabulary', () => {
    expect(Object.keys(derive(weasel, { mode: 'dark' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('declares the same token names in every mode', () => {
    expect(Object.keys(derive(weasel, { mode: 'light' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('grounds the workspace on surface-raised with its tint taken out, in every mode', () => {
    for (const mode of ['dark', 'light']) {
      const tokens = derive(weasel, { mode }).tokens;
      const literal = (name: string): string => {
        const v = String(tokens[name].value);
        return /^\{(.+)\}$/.test(v) ? literal(v.slice(1, -1)) : v;
      };
      const raised = toLch(literal('surface-raised'));
      expect(tokens['workspace-surface'].value).toBe(toHex(raised.L, 0, raised.H));
    }
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
