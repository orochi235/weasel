/**
 * A node that clips its text gets an overlay that scrolls inside the node's
 * box. jsdom lays nothing out, so content sizes and rects are stubbed: these
 * check the geometry and the scroll arithmetic. Whether a browser lays the
 * text out and scrolls it as asserted is in `overlayScroll.browser.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import type { TextEditScreenPose } from './textEditTypes';
import { getOverlay, makeHarness } from './testing/textEditHarness';

const INSET = { top: 10, right: 10, bottom: 10, left: 10 };
/** A 200 × 120 note at (100, 50) with a 10px padding: its text box is 180 × 100. */
const POSE: TextEditScreenPose = {
  x: 110, y: 60, width: 180, height: 100, fontSize: 16, lineHeight: 1.5, clip: INSET,
};

/** Every div the hook makes reports these sizes, the overlay among them. */
function stubSizes(size: { width: number; height: number }) {
  const make = document.createElement.bind(document);
  return vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = make(tag);
    if (tag === 'div') {
      Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => size.height });
      Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => size.width });
    }
    return el;
  });
}

function open(pose: TextEditScreenPose, style: TextStyle = { fontSize: 16, wrap: true }) {
  const h = makeHarness({ a: 'hi' });
  h.opts.getScreenPose = () => pose;
  h.opts.getStyle = () => style;
  const hook = renderHook(() => useTextEdit(h.opts));
  act(() => hook.result.current.startEdit('a'));
  const el = getOverlay(h.container)!;
  return { h, hook, el, box: el.parentElement! };
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

describe('useTextEdit — a clipped node scrolls in its box', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('makes the node box a scroll container the overlay fills, padded by the inset', () => {
    const { box, el } = open(POSE);
    expect(box.style.overflow).toBe('auto');
    expect([box.style.left, box.style.top, box.style.width, box.style.height])
      .toEqual(['100px', '50px', '200px', '120px']);
    expect(box.style.pointerEvents).toBe('auto');
    expect(box.style.getPropertyValue('scrollbar-width')).toBe('none');
    expect([el.style.left, el.style.top, el.style.width, el.style.minHeight])
      .toEqual(['0px', '0px', '200px', '120px']);
    expect([el.style.paddingTop, el.style.paddingRight, el.style.paddingBottom, el.style.paddingLeft])
      .toEqual(['10px', '10px', '10px', '10px']);
    expect(el.style.clipPath).toBe('');
    expect(el.style.transform).toBe('none');
  });

  it('puts the view scale on the box, about its corner, so the paper and the text move together', () => {
    const { box, el } = open({ ...POSE, zoom: 2 });
    // The inset is pre-scale: the box's corner is 20 screen pixels out from the text's.
    expect([box.style.left, box.style.top]).toEqual(['90px', '40px']);
    expect(box.style.transform).toBe('scale(2)');
    expect(box.style.transformOrigin).toMatch(/^0(px)? 0(px)?$/);
    expect(el.style.transform).toBe('none');
  });

  it('opens a bottom-aligned overflowing text scrolled to its end, as the canvas shows it', () => {
    const spy = stubSizes({ width: 0, height: 300 });
    const { box, el } = open({ ...POSE, verticalAlign: 'bottom' });
    spy.mockRestore();
    // Set from the top, so the start can be scrolled to.
    expect(el.style.paddingTop).toBe('10px');
    expect(box.scrollTop).toBe(200);
  });

  it('opens a centered overflowing text scrolled half way', () => {
    const spy = stubSizes({ width: 0, height: 300 });
    const { box } = open({ ...POSE, verticalAlign: 'center' });
    spy.mockRestore();
    expect(box.scrollTop).toBe(100);
  });

  it('aligns text that fits with padding, and does not scroll it', () => {
    const spy = stubSizes({ width: 0, height: 30 });
    const { box, el } = open({ ...POSE, verticalAlign: 'bottom' });
    spy.mockRestore();
    expect(el.style.paddingTop).toBe('80px');
    expect(box.scrollTop).toBe(0);
  });

  it('keeps the user\'s scroll from where the alignment rests as the text grows', () => {
    const size = { width: 0, height: 300 };
    const spy = stubSizes(size);
    const { box, el } = open({ ...POSE, verticalAlign: 'bottom' });
    box.dispatchEvent(new Event('wheel'));
    box.scrollTop = 150;
    box.dispatchEvent(new Event('scroll'));
    size.height = 340;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    spy.mockRestore();
    // Rest moved from 200 to 240; the user was 50 above it.
    expect(box.scrollTop).toBe(190);
  });

  it('puts back a scroll the browser makes before the user has touched the text', () => {
    const spy = stubSizes({ width: 0, height: 300 });
    const { box } = open({ ...POSE, verticalAlign: 'bottom' });
    spy.mockRestore();
    box.scrollTop = 181;
    box.dispatchEvent(new Event('scroll'));
    expect(box.scrollTop).toBe(200);
  });

  it('opens an unwrapped centered line wider than the box scrolled to its middle', () => {
    const spy = stubSizes({ width: 300, height: 0 });
    const { box, el } = open(POSE, { fontSize: 16, align: 'center' });
    spy.mockRestore();
    expect(el.style.width).toBe('320px');
    expect(el.style.paddingLeft).toBe('10px');
    expect(box.scrollLeft).toBe(60);
  });

  it('does not end the edit on a press in the box outside the overlay', () => {
    const { h, hook, box } = open(POSE);
    box.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(hook.result.current.editingId).toBe('a');
    expect(h.commits).toEqual([]);
  });

  it('removes the box, and with it the scroll, when the edit ends', () => {
    const { h, hook, box } = open(POSE);
    box.scrollTop = 40;
    act(() => hook.result.current.commitEdit());
    expect(box.isConnected).toBe(false);
    act(() => hook.result.current.startEdit('a'));
    expect(getOverlay(h.container)!.parentElement!.scrollTop).toBe(0);
  });
});

describe('useTextEdit — the caret brings the clipped text into view', () => {
  let caret = rect(0, 0, 0, 0);
  let box = rect(0, 0, 200, 120);
  const saved = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => caret });
  });
  afterEach(() => {
    if (saved) Object.defineProperty(Range.prototype, 'getBoundingClientRect', saved);
    else delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  });

  function openWithRects(pose: TextEditScreenPose) {
    const opened = open(pose);
    opened.box.getBoundingClientRect = () => box;
    return opened;
  }
  const selectionMoved = () => document.dispatchEvent(new Event('selectionchange'));

  it('leaves the scroll alone for the caret the edit opens with', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, 250, 1, 24);
    const { box: el } = openWithRects(POSE);
    selectionMoved();
    expect(el.scrollTop).toBe(0);
  });

  it('scrolls a caret the user moved below the box up into its inset', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, 238, 0, 24);
    const { box: el, el: overlay } = openWithRects(POSE);
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    selectionMoved();
    // The caret's line, 24 tall about y 250, ends at 262; the inset's bottom is 110.
    expect(el.scrollTop).toBe(152);
  });

  it('scrolls a caret above the box down into its inset', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, -42, 0, 24);
    const { box: el, el: overlay } = openWithRects(POSE);
    el.scrollTop = 100;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    selectionMoved();
    // Line top at -42 comes to the inset's top at 10.
    expect(el.scrollTop).toBe(48);
  });

  it('follows the caret as typing moves it', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, 238, 0, 24);
    const { box: el, el: overlay } = openWithRects(POSE);
    overlay.dispatchEvent(new Event('beforeinput', { bubbles: true }));
    overlay.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.scrollTop).toBe(152);
  });

  it('measures the caret in the box\'s own pixels under a zoom', () => {
    box = rect(0, 0, 400, 240);
    caret = rect(100, 476, 0, 48);
    const { box: el, el: overlay } = openWithRects({ ...POSE, zoom: 2 });
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    selectionMoved();
    expect(el.scrollTop).toBe(152);
  });

  it('leaves a caret already in the box where it is', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, 80, 0, 24);
    const { box: el, el: overlay } = openWithRects(POSE);
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    selectionMoved();
    expect(el.scrollTop).toBe(0);
  });

  it('scrolls an unclipped overlay never', () => {
    box = rect(0, 0, 200, 120);
    caret = rect(50, 238, 0, 24);
    const { clip: _clip, ...loose } = POSE;
    const { box: el, el: overlay } = openWithRects(loose);
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    selectionMoved();
    expect(el.scrollTop).toBe(0);
  });
});
