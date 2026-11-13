import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { layoutPages } from '@weasel-js/core';
import type { DocPages } from '@weasel-js/editor';
import { DOC_KEY } from './docPersistence';
import { drawScene } from './testScenes';
import { useDocumentState } from './useDocumentState';

afterEach(() => localStorage.clear());

function pagesShowing(index: number | null): DocPages {
  const placed = layoutPages([{ id: 'page-1', width: 816, height: 1056 }, { id: 'page-2', width: 794, height: 1123 }]);
  return {
    placed, current: null, shown: index === null ? null : placed[index]!,
    goTo: vi.fn(), step: vi.fn(), add: vi.fn(), remove: vi.fn(), removable: vi.fn(() => true as const), move: vi.fn(), rename: vi.fn(), resize: vi.fn(),
  };
}

describe('useDocumentState', () => {
  it("edits the scene's background, which undo takes back, and keeps the filename out of history", () => {
    vi.useFakeTimers();
    const scene = drawScene();
    const { result } = renderHook(() => useDocumentState(scene, pagesShowing(0), false));
    act(() => result.current.setFilename('poster.svg'));
    act(() => result.current.setBackgroundColor('#336699'));
    expect(result.current.backgroundColor).toBe('#336699');
    act(() => { scene.undo(); });
    expect(result.current.backgroundColor).toBe('#ffffff');
    expect(result.current.filename).toBe('poster.svg');
    act(() => { vi.advanceTimersByTime(300); });
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toEqual({ filename: 'poster.svg' });
    vi.useRealTimers();
  });

  it('keeps the paper size and background an older drawing kept beside it, which the scene has yet to take in', () => {
    vi.useFakeTimers();
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'a.svg', paperSize: 'a4', backgroundColor: '#ff0000' }));
    const { result } = renderHook(() => useDocumentState(drawScene(), pagesShowing(0), false));
    act(() => result.current.setFilename('b.svg'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toEqual({ filename: 'b.svg', paperSize: 'a4', backgroundColor: '#ff0000' });
    vi.useRealTimers();
  });

  it('reads the paper size off the shown page', () => {
    expect(renderHook(() => useDocumentState(drawScene(), pagesShowing(1), false)).result.current.paperSize).toBe('a4');
    expect(renderHook(() => useDocumentState(drawScene(), pagesShowing(0), false)).result.current.paperSize).toBe('letter');
  });

  it('reads null off a page of none of the paper sizes, and the default with no page shown', () => {
    const custom = pagesShowing(0);
    const placed = layoutPages([{ id: 'page-1', width: 500, height: 700 }]);
    const pages = { ...custom, placed, shown: placed[0]! };
    expect(renderHook(() => useDocumentState(drawScene(), pages, false)).result.current.paperSize).toBeNull();
    expect(renderHook(() => useDocumentState(drawScene(), pagesShowing(null), false)).result.current.paperSize).toBe('letter');
  });

  it('resizes the shown page to a paper size, and fits the view to it', () => {
    const pages = pagesShowing(1);
    const { result } = renderHook(() => useDocumentState(drawScene(), pages, false));
    act(() => result.current.setPaperSize('legal'));
    expect(pages.resize).toHaveBeenCalledWith('page-2', { width: 816, height: 1344 });
    expect(pages.goTo).toHaveBeenCalledWith('page-2');
  });

  it('changes nothing with no page shown', () => {
    const pages = pagesShowing(null);
    const { result } = renderHook(() => useDocumentState(drawScene(), pages, false));
    act(() => result.current.setPaperSize('legal'));
    expect(pages.resize).not.toHaveBeenCalled();
  });
});
