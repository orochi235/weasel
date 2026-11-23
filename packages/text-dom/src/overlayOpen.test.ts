import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';
import { installSelectionStyle, openingRange } from './overlayOpen';

afterEach(() => {
  document.head.innerHTML = '';
  vi.restoreAllMocks();
});

describe('installSelectionStyle', () => {
  it('writes a selection color that is not a CSS color nowhere, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const style = resolveTextStyle({
      selectionBackground: '#ff0',
      selectionColor: 'rgb(0 0 0) } body { background: url(x)',
    });
    const el = installSelectionStyle('edit-1', style);
    expect(el?.textContent).toBe('.edit-1::selection, .edit-1 *::selection { background: #ff0; }');
    expect(document.head.textContent).not.toContain('body');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/selectionColor .* is not a CSS color/));
  });

  it('writes nothing when no color is one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const style = resolveTextStyle({ selectionBackground: 'red; } * { color: red', caretColor: '#000' });
    expect(installSelectionStyle('edit-2', style)).toBeNull();
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
  });
});

describe('openingRange', () => {
  it('clamps a negative caret to the start of the text', () => {
    const overlay = document.createElement('div');
    overlay.textContent = 'abc';
    const range = openingRange(overlay, -1);
    expect(range.collapsed).toBe(true);
    expect(range.startContainer).toBe(overlay.firstChild);
    expect(range.startOffset).toBe(0);
  });

  it("puts an 'end' caret after the last character", () => {
    const overlay = document.createElement('div');
    overlay.textContent = 'abc';
    const range = openingRange(overlay, 'end');
    expect(range.collapsed).toBe(true);
    expect(range.startContainer).toBe(overlay.firstChild);
    expect(range.startOffset).toBe(3);
  });
});
