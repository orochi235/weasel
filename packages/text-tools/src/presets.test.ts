import { describe, expect, it } from 'vitest';
import { textPreset, textToolsPreset, whiteboardPreset } from './featurePresets';
import * as presets from './presets';

describe('@weasel-js/text-tools/presets', () => {
  it('names each preset by its short name, as the same object', () => {
    expect(Object.keys(presets).sort()).toEqual(['text', 'textTools', 'whiteboard']);
    expect(presets.text).toBe(textPreset);
    expect(presets.textTools).toBe(textToolsPreset);
    expect(presets.whiteboard).toBe(whiteboardPreset);
  });
});
