import type { ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { child, lookupOf, weasel } from './fixtures';
import { countTokens } from './model';
import { layerRows } from './rows';

const lookup = lookupOf(child);

describe('layerRows', () => {
  it('lists every pin, with what each override replaced', () => {
    const rows = layerRows('pins', weasel, derive(weasel, { mode: 'dark' }, lookup));
    expect(rows).toHaveLength(89);
    expect(rows.find((r) => r.name === 'gray-800')).toMatchObject({ type: 'color', replaced: '#1a1c21' });
    expect(rows.find((r) => r.name === 'radius-md')).not.toHaveProperty('replaced');
  });

  it('lists a pin only where it applies, as the rail counts it', () => {
    const def = { ...weasel, pins: { ...weasel.pins, gap: { by: 'mode', dark: { value: '4px', type: 'dimension' } } } } as ThemeDefinition;
    for (const mode of ['dark', 'light']) {
      const result = derive(def, { mode }, lookup);
      expect(layerRows('pins', def, result)).toHaveLength(countTokens(def, result).layers.pins.count);
    }
  });

  it('shows a pinned alpha', () => {
    const rows = layerRows('pins', weasel, derive(weasel, { mode: 'dark' }, lookup));
    expect(rows.find((r) => r.name === 'line-subtle')).toMatchObject({ value: '{fg} at 10%' });
  });

  it("lists a layer's own tokens only", () => {
    expect(layerRows('semantics', weasel, derive(weasel, { mode: 'dark' }, lookup)).map((r) => r.name)).toHaveLength(11);
    const childRows = layerRows('semantics', child, derive(child, { mode: 'dark' }, lookup));
    expect(childRows).toEqual([{ name: 'surface', type: 'color', value: '#0a0a14', replaced: '{gray-800}' }]);
  });

  it('lists seeds by name', () => {
    const seeded = { ...weasel, seeds: { brand: '#0b6e8a', unit: 4 } };
    expect(layerRows('seeds', seeded, derive(seeded, { mode: 'dark' }, lookup))).toEqual([
      { name: 'seeds.brand', type: 'seed', value: '#0b6e8a' },
      { name: 'seeds.unit', type: 'seed', value: '4' },
    ]);
  });
});
