import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getOverlay, makeHarness } from './testing/textEditHarness';

// A face that never finishes loading, so only the hold decides when the overlay shows.
vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  cssFontFamilyLoading: () => new Promise<void>(() => {}),
}));

const { useTextEdit } = await import('./useTextEdit');

describe('useTextEdit fontHold', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hides the overlay while a face loads by default', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.opacity).toBe('0');
  });

  it('shows the overlay at once under a hold of 0', () => {
    const h = makeHarness({ a: 'hi' });
    h.opts.fontHold = 0;
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.opacity).toBe('');
  });
});
