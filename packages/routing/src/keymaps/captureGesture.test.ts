import { afterEach, describe, it, expect, vi } from 'vitest';
import { DOUBLE_CLICK_MAX_MS, DRAG_THRESHOLD_PX, key } from '@weasel-js/gestures';
import { captureGesture } from './captureGesture';

const fire = (type: string, init: PointerEventInit = {}): PointerEvent => {
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', ...init });
  window.dispatchEvent(e);
  return e;
};

/** A press and release at one point, with the DOM click the browser follows it with. */
const clickAt = (x: number, y: number, mods: PointerEventInit = {}): void => {
  fire('pointerdown', { clientX: x, clientY: y, ...mods });
  fire('pointerup', { clientX: x, clientY: y, ...mods });
  fire('click', { clientX: x, clientY: y, ...mods });
};

afterEach(() => { vi.useRealTimers(); });

describe('captureGesture', () => {
  it('captures a click, with Cmd as Mod on an Apple platform', async () => {
    const got = captureGesture(window, { kinds: ['click', 'drag'], apple: true });
    clickAt(10, 10, { metaKey: true, shiftKey: true });
    expect(await got).toEqual({ kind: 'click', mods: { mod: true, shift: true } });
  });

  it('captures a drag once the press travels past the drag threshold, on its release', async () => {
    const got = captureGesture(window, { kinds: ['click', 'drag'], apple: false });
    fire('pointerdown', { clientX: 0, clientY: 0, ctrlKey: true });
    fire('pointermove', { clientX: DRAG_THRESHOLD_PX + 1, clientY: 0, ctrlKey: true });
    fire('pointerup', { clientX: 30, clientY: 0 });
    expect(await got).toEqual({ kind: 'drag', mods: { mod: true } });
  });

  it('reads a press that stays under the drag threshold as a click', async () => {
    const got = captureGesture(window, { kinds: ['click', 'drag'] });
    fire('pointerdown', { clientX: 0, clientY: 0 });
    fire('pointermove', { clientX: DRAG_THRESHOLD_PX - 1, clientY: 0 });
    fire('pointerup', { clientX: DRAG_THRESHOLD_PX - 1, clientY: 0 });
    expect(await got).toEqual({ kind: 'click' });
  });

  it('waits past a kind it was not asked for', async () => {
    const got = captureGesture(window, { kinds: ['drag'] });
    clickAt(5, 5);
    fire('pointerdown', { clientX: 0, clientY: 0 });
    fire('pointermove', { clientX: 20, clientY: 20 });
    fire('pointerup', { clientX: 20, clientY: 20 });
    expect(await got).toEqual({ kind: 'drag' });
  });

  it('holds a click back for a double click when it takes both', async () => {
    vi.useFakeTimers();
    const single = captureGesture(window, { kinds: ['click', 'doubleClick'] });
    let settled = false;
    void single.then(() => { settled = true; });
    clickAt(10, 10);
    await Promise.resolve();
    expect(settled).toBe(false);
    vi.advanceTimersByTime(DOUBLE_CLICK_MAX_MS + 1);
    expect(await single).toEqual({ kind: 'click' });

    const double = captureGesture(window, { kinds: ['click', 'doubleClick'] });
    clickAt(10, 10, { altKey: true });
    clickAt(11, 10, { altKey: true });
    expect(await double).toEqual({ kind: 'doubleClick', mods: { alt: true } });
    vi.runOnlyPendingTimers();
  });

  it('captures a right click as a context menu, and keeps the native menu shut', async () => {
    const got = captureGesture(window, { kinds: ['click', 'contextMenu'] });
    fire('pointerdown', { button: 2, clientX: 0, clientY: 0 });
    const menu = fire('contextmenu', { button: 2, shiftKey: true });
    expect(await got).toEqual({ kind: 'contextMenu', mods: { shift: true } });
    expect(menu.defaultPrevented).toBe(true);
  });

  it('takes every event of what it captures from the page', async () => {
    const heard: string[] = [];
    const listen = (e: Event): void => { heard.push(e.type); };
    const types = ['pointerdown', 'pointermove', 'pointerup', 'click'];
    for (const t of types) document.body.addEventListener(t, listen);
    const got = captureGesture(window, { kinds: ['click'] });
    const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 });
    document.body.dispatchEvent(down);
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(click);
    expect(await got).toEqual({ kind: 'click' });
    for (const t of types) document.body.removeEventListener(t, listen);
    expect(heard).toEqual([]);
    expect(down.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);
  });

  it('captures a keystroke beside pointer gestures', async () => {
    const got = captureGesture(window, { kinds: ['key', 'click'], apple: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true, cancelable: true }));
    expect(await got).toEqual(key('Mod+K'));
  });

  it('leaves the pointer alone when it takes keys only', async () => {
    const got = captureGesture(window, { kinds: ['key'] });
    const down = fire('pointerdown', { clientX: 0, clientY: 0 });
    fire('pointerup', { clientX: 0, clientY: 0 });
    expect(down.defaultPrevented).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));
    expect(await got).toEqual(key('a'));
  });

  it('resolves null on Escape, even mid-press, and on abort', async () => {
    const esc = captureGesture(window, { kinds: ['click', 'drag'] });
    fire('pointerdown', { clientX: 0, clientY: 0 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(await esc).toBeNull();
    fire('pointerup', { clientX: 0, clientY: 0 });

    const ctl = new AbortController();
    const aborted = captureGesture(window, { kinds: ['click'], signal: ctl.signal });
    ctl.abort();
    expect(await aborted).toBeNull();
  });
});
