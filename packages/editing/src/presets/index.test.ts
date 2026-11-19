import { describe, expect, it } from 'vitest';
import { FEATURE_PRESETS } from '../namedPresets';
import * as presets from './index';

describe('@weasel-js/editing/presets', () => {
  it('carries every named kit preset, as the same object', () => {
    const exported = new Set<unknown>(Object.values(presets));
    const missing = Object.entries(FEATURE_PRESETS).filter(([, p]) => !exported.has(p)).map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('names each by its short name', () => {
    expect(presets.pick).toBe(FEATURE_PRESETS.pick);
    expect(presets.delete).toBe(FEATURE_PRESETS.delete);
    expect(presets.selectTools).toBe(FEATURE_PRESETS['tools:select']);
  });
});
