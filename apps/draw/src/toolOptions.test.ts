import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { openDrawPrefs } from './prefs';
import { drawToolOptionValues } from './toolOptions';

describe('drawToolOptionValues', () => {
  it("keeps each brush's options as prefs, so they outlive a reload", async () => {
    const backing = new Map<string, unknown>();
    const prefs = openDrawPrefs(createMemoryAdapter(backing));
    const values = drawToolOptionValues(prefs);
    expect(values.get('knead')).toEqual({ radiusPx: 40, strength: 0.6 });
    values.set('knead', 'radiusPx', 64);
    values.set('sand', 'tolerance', 3);
    await prefs.flush();
    const reopened = drawToolOptionValues(openDrawPrefs(createMemoryAdapter(backing)));
    expect(reopened.get('knead').radiusPx).toBe(64);
    expect(reopened.get('sand').tolerance).toBe(3);
  });
});
