import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { overlayTop, useTextEdit } from './useTextEdit';
import type { UseTextEditOptions } from './textEditTypes';
import type { StyledRun } from '@weasel-js/text';
import { resolveScreenLength } from '@weasel-js/paint';
import type { TextStyle } from '@weasel-js/text';
import { makeHarness, getOverlay } from './testing/textEditHarness';

describe('overlayTop', () => {
  const pose = { x: 0, y: 100, width: 200, height: 90, fontSize: 16 };

  it('sits at the pose top when top-aligned or unaligned', () => {
    expect(overlayTop(pose, 30)).toBe(100);
    expect(overlayTop({ ...pose, verticalAlign: 'top' }, 30)).toBe(100);
  });

  it('shifts by half the slack when centered and all of it at the bottom', () => {
    expect(overlayTop({ ...pose, verticalAlign: 'center' }, 30)).toBe(130);
    expect(overlayTop({ ...pose, verticalAlign: 'bottom' }, 30)).toBe(160);
  });

  it('rises above the box when the content overflows it, as the canvas does', () => {
    expect(overlayTop({ ...pose, verticalAlign: 'bottom' }, 120)).toBe(70);
  });

  it('scales the pre-scale slack and baseline drop by the zoom', () => {
    expect(overlayTop({ ...pose, verticalAlign: 'bottom', zoom: 2 }, 30)).toBe(220);
    expect(overlayTop({ ...pose, zoom: 2 }, 30, -1.5)).toBe(97);
  });
});

describe('useTextEdit — verticalAlign', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /** jsdom lays nothing out, so the overlay's content height is stubbed. */
  function stubContentHeight(el: HTMLElement, read: () => number) {
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: read });
  }

  it('leaves a top-aligned overlay filling its box', () => {
    const h = makeHarness({ a: 'hi' });
    h.opts.getScreenPose = () => ({
      x: 0, y: 100, width: 200, height: 90, fontSize: 16, verticalAlign: 'top',
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const el = getOverlay(h.container)!;
    expect(el.style.top).toBe('100px');
    expect(el.style.minHeight).toBe('90px');
  });

  // Proxy: what is asserted is that the overlay re-reads its height on
  // `input` and places from it. Whether that height is the text's real line
  // box is layout, which only a browser has.
  it('re-measures its content on input and moves a bottom-aligned overlay up', () => {
    const h = makeHarness({ a: 'hi' });
    h.opts.getScreenPose = () => ({
      x: 0, y: 100, width: 200, height: 90, fontSize: 16, verticalAlign: 'bottom',
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    let height = 0;
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'div') stubContentHeight(el, () => height);
      return el;
    });
    height = 30;
    act(() => result.current.startEdit('a'));
    spy.mockRestore();
    const el = getOverlay(h.container)!;
    expect(el.style.minHeight).toBe('');
    expect(el.style.top).toBe('160px');

    height = 60;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.style.top).toBe('130px');
  });
});

describe('useTextEdit — clip rect', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // Style proxies: whether a clip box actually clips, and refuses to scroll
  // after a caret, is measured in tests/visual/text-edit-overlay.spec.ts.
  it('clips the overlay to getClipRect and places it relative to that box', () => {
    const h = makeHarness({ a: 'hi' });
    h.opts.getScreenPose = () => ({ x: 50, y: 30, width: 200, height: 40, fontSize: 16 });
    h.opts.getClipRect = () => ({ x: 10, y: 20, width: 300, height: 100 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const el = getOverlay(h.container)!;
    const clip = el.parentElement!;
    expect(clip.parentElement).toBe(h.container);
    expect(clip.style.overflow).toBe('clip');
    expect(clip.style.pointerEvents).toBe('none');
    expect([clip.style.left, clip.style.top, clip.style.width, clip.style.height])
      .toEqual(['10px', '20px', '300px', '100px']);
    expect(el.style.pointerEvents).toBe('auto');
    // Pose (50, 30) in container pixels, less the box origin.
    expect(el.style.left).toBe('40px');
    expect(el.style.top).toBe('10px');
  });

  it('clips nothing without a clip rect', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const el = getOverlay(h.container)!;
    expect(el.parentElement!.style.overflow).toBe('visible');
    expect(el.style.left).toBe('0px');
  });

  it('removes the clip box when the edit ends', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.cancelEdit());
    expect(h.container.childElementCount).toBe(0);
  });
});

/** Same as `makeTrackingHarness`, but the pose declares an explicit `zoom`
 *  so every metric on it is pre-scale (world) and the overlay carries the
 *  view scale as a CSS transform instead. */
function makeZoomedHarness(runs: StyledRun[], style: TextStyle, zoom: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const opts: UseTextEditOptions = {
    container,
    getText: () => runs.map((r) => r.text).join(''),
    getStyle: () => style,
    getScreenPose: () => ({
      x: 10,
      y: 20,
      width: 200,
      height: 40,
      fontSize: resolveScreenLength(style.fontSize ?? 16, 1),
      zoom,
    }),
    setText: () => {},
    getRuns: () => runs,
    setRuns: () => {},
  };
  return { opts, container };
}

describe('useTextEdit — zoom-scaled overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carries the zoom as a CSS scale anchored at the overlay origin', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.transform).toBe('scale(2)');
    expect(overlay.style.transformOrigin).toBe('0 0');
  });

  it('emits no transform at zoom 1', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 1);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.transform).toBe('none');
  });

  it('keeps x / y in screen pixels — the scale is anchored, not translated', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.left).toBe('10px');
    expect(overlay.style.top).toBe('20px');
  });

  it('leaves width / height / fontSize pre-scale — the transform does the scaling', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16, wrap: true }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.width).toBe('200px');
    expect(overlay.style.minHeight).toBe('40px');
    expect(overlay.style.fontSize).toBe('16px');
  });

  it('anchors an unwrapped right-aligned overlay on the scaled box edge', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16, align: 'right' }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // 10 + 200 * 2; the translate is pre-scale, so it moves the box back by
    // its own scaled width.
    expect(overlay.style.left).toBe('410px');
    expect(overlay.style.minWidth).toBe('200px');
    expect(overlay.style.transform).toBe('scale(2) translateX(-100%)');
  });

  it('does not pre-scale letterSpacing when the pose declares a zoom', () => {
    // This is the whole point of the transform: `runsToDom` writes run-level
    // `fontSize` / `letterSpacing` in world units (`domToRuns` reads them
    // straight back), so the node level has to stay in world units too or the
    // two disagree at any zoom but 1.
    const h = makeZoomedHarness(
      [{ text: 'a' }, { text: 'b', letterSpacing: 2, fontSize: 24 }],
      { fontSize: 16, letterSpacing: 3 },
      2,
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll<HTMLSpanElement>('span[data-run]');
    expect(overlay.style.letterSpacing).toBe('3px');
    expect(spans[1].style.letterSpacing).toBe('2px');
    expect(spans[1].style.fontSize).toBe('24px');
    // Asserted here too: raw world values are only correct *because* the
    // transform scales them. Drop the transform and these numbers are wrong.
    expect(overlay.style.transform).toBe('scale(2)');
  });
});
