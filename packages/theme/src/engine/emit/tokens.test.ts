import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../definition';
import { generateTokens } from './tokens';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const weasel = JSON.parse(readFileSync(resolve(pkg, 'themes/weasel.json'), 'utf8')) as ThemeDefinition;
const definitions = readdirSync(resolve(pkg, 'themes'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(pkg, 'themes', f), 'utf8')) as ThemeDefinition);
const committed = (file: string) => readFileSync(resolve(pkg, 'src/generated', file), 'utf8');

describe('generateTokens', () => {
  it('produces the committed files from themes/', () => {
    const result = generateTokens(definitions);
    if (!result.ok) throw new Error(result.problems.join('\n'));
    for (const file of ['tokens.css', 'themes.ts', 'manifest.ts'] as const) expect(result.files[file]).toBe(committed(file));
  });

  it('refuses a definition with derive issues and names each one', () => {
    const probe = { ramp: 'gray', contrast: { min: 30, against: ['surface'] } };
    const result = generateTokens([{ ...weasel, semantics: { ...weasel.semantics, probe } }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // One per selection: every mode crossed with every density.
    expect(result.problems).toHaveLength(6);
    expect(result.problems.every((p) => p.includes('contrast-unmet'))).toBe(true);
  });

  it('refuses an axis with no values, naming the axis', () => {
    const result = generateTokens([{ ...weasel, axes: { ...weasel.axes, density: { default: 'comfortable', values: {} } } }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join('\n')).toMatch(/axes\.density.*no values/);
  });

  it('refuses an axis whose default is not one of its values, naming both', () => {
    const mode = { default: 'dusk', values: weasel.axes!.mode.values };
    const result = generateTokens([{ ...weasel, axes: { ...weasel.axes, mode } }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join('\n')).toMatch(/axes\.mode.*dusk/);
  });

  it('throws unless exactly one definition extends nothing', () => {
    expect(() => generateTokens([weasel, { ...weasel, name: 'twin' }])).toThrow(/exactly one/);
  });
});
