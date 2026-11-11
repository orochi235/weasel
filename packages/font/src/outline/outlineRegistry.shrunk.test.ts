/** Counterexamples the outline properties shrank to, kept as examples. */
import { afterEach, describe, expect, it } from 'vitest';
import { interBytes } from '../pbt.fixture';
import { _resetFontOutlinesForTests, glyphOutline, loadFontOutlines, registerFontOutlines } from './outlineRegistry';

afterEach(() => _resetFontOutlinesForTests());

describe('outline registry, shrunk', () => {
  it('reads bytes from another realm, as Node hands them to a test under jsdom', async () => {
    const bytes = interBytes();
    expect(bytes instanceof ArrayBuffer).toBe(false);
    registerFontOutlines('f', {}, bytes);
    expect(await loadFontOutlines('f')).toBe('ready');
    expect(glyphOutline('f', 400, 'normal', 65)).toMatch(/^M/);
  });
});
