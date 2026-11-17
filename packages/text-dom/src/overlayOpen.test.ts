import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';
import { installSelectionStyle } from './overlayOpen';

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
    expect(el?.textContent).toBe('.edit-1::selection { background: #ff0; }');
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
