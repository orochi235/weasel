import type { ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { layerEntries } from './entries';
import { child, lookupOf, weasel } from './fixtures';
import { countTokens } from './model';

const lookup = lookupOf(child);
const derived = (def: ThemeDefinition, mode = 'dark') => derive(def, { mode }, lookup);

describe('layerEntries', () => {
  it('groups a token by the name up to its first hyphen, as the emitted manifest does', () => {
    const entries = layerEntries('pins', weasel, derived(weasel));
    expect(entries.find((e) => e.name === 'gray-800')).toMatchObject({ group: 'gray', type: 'color' });
    expect(entries.find((e) => e.name === 'radius-md')).toMatchObject({ group: 'radius' });
  });

  it('marks every pin overridden, because a pin is itself the override Reset drops', () => {
    expect(layerEntries('pins', weasel, derived(weasel)).every((e) => e.overridden)).toBe(true);
  });

  it('offers a pinned alpha as the value alone, so editing cannot write the percentage back', () => {
    const entries = layerEntries('pins', weasel, derived(weasel));
    expect(entries.find((e) => e.name === 'line-subtle')).toMatchObject({ value: '{fg}' });
  });

  it('types a seed from its value, so a hex seed edits as a color and a number as a number', () => {
    const seeded = { ...weasel, seeds: { brand: '#0b6e8a', unit: 4 } } as ThemeDefinition;
    expect(layerEntries('seeds', seeded, derived(seeded))).toEqual([
      { name: 'seeds.brand', type: 'color', group: 'seeds', value: '#0b6e8a' },
      { name: 'seeds.unit', type: 'number', group: 'seeds', value: '4' },
    ]);
  });

  it('serializes an array value the way the emitter does, not as JSON', () => {
    const entries = layerEntries('pins', weasel, derived(weasel));
    expect(entries.find((e) => e.name === 'ease-out-cubic')?.value).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
    expect(entries.find((e) => e.name === 'font-ui')?.value).toBe(
      "Oswald, 'Helvetica Neue Condensed', 'Arial Narrow', system-ui, sans-serif",
    );
  });

  it('lists a pin only where it applies, as the rail counts it', () => {
    const def = { ...weasel, pins: { ...weasel.pins, gap: { by: 'mode', dark: { value: '4px', type: 'dimension' } } } } as ThemeDefinition;
    for (const mode of ['dark', 'light']) {
      const result = derived(def, mode);
      expect(layerEntries('pins', def, result)).toHaveLength(countTokens(def, result).layers.pins.count);
    }
  });

  it("lists a component layer's own tokens", () => {
    const def = { ...weasel, components: { 'tb-height': { value: '28px', type: 'dimension' } } } as ThemeDefinition;
    expect(layerEntries('components', def, derived(def)).find((e) => e.name === 'tb-height')).toMatchObject({
      type: 'dimension',
      value: '28px',
      group: 'tb',
    });
  });

  it('leaves a component token unmarked when nothing pins it', () => {
    const fresh = 'demo-gap';
    // Vacuous if weasel ever pins this name itself, which is what makes tb-height below overridden.
    expect(Object.hasOwn(weasel.pins ?? {}, fresh)).toBe(false);
    const def = { ...weasel, components: { [fresh]: { value: '3px', type: 'dimension' } } } as ThemeDefinition;
    expect(layerEntries('components', def, derived(def)).find((e) => e.name === fresh)?.overridden).toBe(false);
  });

  it('marks a component token overridden where a pin replaced it', () => {
    expect(Object.hasOwn(weasel.pins ?? {}, 'tb-height')).toBe(true);
    const def = { ...weasel, components: { 'tb-height': { value: '28px', type: 'dimension' } } } as ThemeDefinition;
    expect(layerEntries('components', def, derived(def)).find((e) => e.name === 'tb-height')?.overridden).toBe(true);
  });
});
