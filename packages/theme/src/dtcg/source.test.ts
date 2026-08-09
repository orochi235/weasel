import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenTokens } from './flatten';

const here = dirname(fileURLToPath(import.meta.url));
const tokensDir = resolve(here, '../../tokens/weasel');

const readJson = (p: string) => JSON.parse(readFileSync(resolve(tokensDir, p), 'utf8'));

/** The intended token vocabulary. */
const EXPECTED_NAMES = [
  'gray-50', 'gray-100', 'gray-200', 'gray-300', 'gray-400',
  'gray-500', 'gray-600', 'gray-700', 'gray-800', 'gray-900',
  'accent-soft', 'accent-base', 'accent-strong',
  'danger-base', 'warning-base', 'success-base',
  'radius-sm', 'radius-md', 'radius-lg', 'border-w', 'line-width', 'curve-width',
  'tb-height', 'control-h', 'glass-blur',
  'font-size', 'font-size-sm',
  'space-xs', 'space-sm', 'space-md', 'space-lg',
  'z-toolbar', 'z-overlay', 'z-modal',
  'backdrop',
  'motion-fast', 'motion-medium',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic', 'ease-out-back',
  'line-subtle', 'line', 'line-strong', 'curve-color',
  'swatch-green', 'swatch-pink', 'swatch-cyan', 'swatch-gold', 'swatch-amber',
  'swatch-violet', 'swatch-mint', 'swatch-sky', 'swatch-orange', 'swatch-magenta',
  'font-ui', 'font-display', 'font-body', 'font-mono',
  'font-weight-light', 'font-weight-normal', 'font-weight-medium', 'font-weight-bold',
  'surface', 'surface-raised', 'surface-sunken',
  'fg', 'fg-muted', 'fg-subtle', 'fg-on-accent',
  'border', 'border-strong',
  'accent', 'accent-fg', 'accent-hover',
  'danger', 'warning', 'success', 'focus-ring', 'glass-tint',
  'fg-inverse', 'surface-hover', 'surface-pressed',
].sort();

describe('DTCG source', () => {
  it('declares exactly the intended token vocabulary', () => {
    const names = new Set([
      ...Object.keys(flattenTokens(readJson('primitives.tokens.json'))),
      ...Object.keys(flattenTokens(readJson('modes/dark.tokens.json'))),
    ]);
    expect([...names].sort()).toEqual(EXPECTED_NAMES);
  });

  it('declares the same token names in every mode', () => {
    const dark = Object.keys(flattenTokens(readJson('modes/dark.tokens.json'))).sort();
    const light = Object.keys(flattenTokens(readJson('modes/light.tokens.json'))).sort();
    expect(light).toEqual(dark);
  });
});
