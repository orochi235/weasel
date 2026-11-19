import { describe, expect, it } from 'vitest';
import { viewPreset } from '../canvas/SceneCanvas/presets/view';
import { viewToolsPreset } from '../canvas/SceneCanvas/presets/viewTools';
import * as presets from './presets';

describe('@weasel-js/core/presets', () => {
  it('names each view preset by its short name, as the same object', () => {
    expect(Object.keys(presets).sort()).toEqual(['view', 'viewTools']);
    expect(presets.view).toBe(viewPreset);
    expect(presets.viewTools).toBe(viewToolsPreset);
  });
});
