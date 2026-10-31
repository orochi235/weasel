import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { openDrawPrefs } from './prefs';
import { drawToolOptionValues } from './toolOptions';

describe('drawToolOptionValues', () => {
  it("keeps each brush's options as prefs, so they outlive a reload", async () => {
    const backing = new Map<string, unknown>();
    const prefs = openDrawPrefs(createMemoryAdapter(backing));
    const values = drawToolOptionValues(prefs);
    expect(values.get('smudgeBrush')).toEqual({ radiusPx: 40, strength: 0.6 });
    values.set('smudgeBrush', 'radiusPx', 64);
    values.set('simplifyBrush', 'tolerance', 3);
    await prefs.flush();
    const reopened = drawToolOptionValues(openDrawPrefs(createMemoryAdapter(backing)));
    expect(reopened.get('smudgeBrush').radiusPx).toBe(64);
    expect(reopened.get('simplifyBrush').tolerance).toBe(3);
  });
});
