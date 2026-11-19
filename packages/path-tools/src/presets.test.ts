import { describe, expect, it } from 'vitest';
import { pathToolsPreset } from './featurePresets';
import { pathsPreset } from './pathsPreset';
import * as presets from './presets';

describe('@weasel-js/path-tools/presets', () => {
  it('names each preset by its id', () => {
    for (const [name, preset] of Object.entries(presets)) expect(preset.id, name).toBe(name);
  });

  it("carries every preset of its own that pathTools includes, editing's booleans aside", () => {
    const exported = new Set<unknown>(Object.values(presets));
    const missing = (pathToolsPreset.includes ?? []).filter((p) => p.id !== 'booleans' && !exported.has(p)).map((p) => p.id);
    expect(missing).toEqual([]);
    expect(presets.pathTools).toBe(pathToolsPreset);
    expect(presets.paths).toBe(pathsPreset);
  });
});
