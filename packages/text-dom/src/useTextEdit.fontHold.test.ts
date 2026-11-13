import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getOverlay, makeHarness, makeRichHarness } from './testing/textEditHarness';

// A face that never finishes loading, so only the hold decides when the overlay shows.
const cssFontFamilyLoading = vi.hoisted(() => vi.fn((_family: string, _weight?: number, _style?: string) => new Promise<void>(() => {})));
vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  cssFontFamilyLoading,
}));

const { useTextEdit } = await import('./useTextEdit');

describe('useTextEdit fontHold', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    cssFontFamilyLoading.mockClear();
  });

  it('waits on the face of a run set bold or italic in the node\'s family', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'a' }, { text: 'b', bold: true }, { text: 'c', italic: true }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const variants = cssFontFamilyLoading.mock.calls.map(([, weight, style]) => [weight, style]);
    expect(variants).toContainEqual([700, 'normal']);
    expect(variants).toContainEqual([400, 'italic']);
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
