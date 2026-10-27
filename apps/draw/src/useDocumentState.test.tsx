import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { layoutPages } from '@weasel-js/core';
import type { DocPages } from '@editor/index';
import { useDocumentState } from './useDocumentState';

afterEach(() => localStorage.clear());

function pagesShowing(index: number | null): DocPages {
  const placed = layoutPages([{ id: 'page-1', width: 816, height: 1056 }, { id: 'page-2', width: 794, height: 1123 }]);
  return {
    placed, current: null, shown: index === null ? null : placed[index]!,
    goTo: vi.fn(), step: vi.fn(), add: vi.fn(), remove: vi.fn(), move: vi.fn(), rename: vi.fn(), resize: vi.fn(),
  };
}

describe('useDocumentState', () => {
  it('reads the paper size off the shown page', () => {
    expect(renderHook(() => useDocumentState(pagesShowing(1), false)).result.current.paperSize).toBe('a4');
    expect(renderHook(() => useDocumentState(pagesShowing(0), false)).result.current.paperSize).toBe('letter');
  });

  it('resizes the shown page to a paper size, and fits the view to it', () => {
    const pages = pagesShowing(1);
    const { result } = renderHook(() => useDocumentState(pages, false));
    act(() => result.current.setPaperSize('legal'));
    expect(pages.resize).toHaveBeenCalledWith('page-2', { width: 816, height: 1344 });
    expect(pages.goTo).toHaveBeenCalledWith('page-2');
  });

  it('changes nothing with no page shown', () => {
    const pages = pagesShowing(null);
    const { result } = renderHook(() => useDocumentState(pages, false));
    act(() => result.current.setPaperSize('legal'));
    expect(pages.resize).not.toHaveBeenCalled();
  });
});
