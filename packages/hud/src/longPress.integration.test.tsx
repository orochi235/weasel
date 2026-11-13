// A finger or pen held on a HUD widget reaches it as `longpress`, through the canvas's dispatcher.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { LONG_PRESS_MS } from '@weasel-js/core';
import type { ClaimableGesture } from '@weasel-js/core';
import type { HudPointerEvent, Widget } from './widget';
import { mountHud, pointer, send, stubHudFonts, types } from './hudCanvas.fixture';

/** A widget over (10, 10)–(70, 34), recording what reaches it. */
function panel(seen: HudPointerEvent[], claims?: readonly ClaimableGesture[]): Widget {
  return {
    id: 'panel',
    bounds: { x: 10, y: 10, w: 60, h: 24 },
    hidden: false,
    draw: () => [],
    hitTest: (x, y) => x >= 10 && x < 70 && y >= 10 && y < 34,
    ...(claims ? { claims } : {}),
    onPointer: (e) => { seen.push(e); },
    dispose: () => {},
  };
}

function mount(seen: HudPointerEvent[], opts: { longPressMs?: number; claims?: readonly ClaimableGesture[] } = {}) {
  return mountHud(panel(seen, opts.claims), opts.longPressMs === undefined ? undefined : { longPressMs: opts.longPressMs });
}

function hold(canvas: Element, pointerType: string, ms: number, x = 30, y = 20): void {
  send(canvas, pointer('pointerdown', pointerType, x, y));
  act(() => { vi.advanceTimersByTime(ms); });
}

function settle(): void {
  act(() => { vi.runOnlyPendingTimers(); });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  stubHudFonts();
});
afterEach(() => { vi.useRealTimers(); });

describe('hud.longPress by a held pointer', () => {
  it.each(['touch', 'pen'])('a %s held on a widget reaches it as one longpress at the press point', async (kind) => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    hold(canvas, kind, LONG_PRESS_MS - 1);
    expect(types(seen)).not.toContain('longpress');
    act(() => { vi.advanceTimersByTime(1); });
    expect(seen.filter((e) => e.type === 'longpress')).toEqual([{ type: 'longpress', x: 30, y: 20, native: null }]);
  });

  it('a mouse held on a widget is not a long-press', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    hold(canvas, 'mouse', LONG_PRESS_MS * 2);
    expect(types(seen)).not.toContain('longpress');
  });

  it('waits the gestures.longPressMs kit setting', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen, { longPressMs: 900 });
    hold(canvas, 'touch', LONG_PRESS_MS);
    expect(types(seen)).not.toContain('longpress');
    act(() => { vi.advanceTimersByTime(400); });
    expect(types(seen)).toContain('longpress');
  });

  it('a hold off the chrome does not reach the widget', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    hold(canvas, 'touch', LONG_PRESS_MS, 150, 150);
    expect(seen).toEqual([]);
  });

  it('a widget that does not claim longPress never hears one', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen, { claims: ['pointer'] });
    hold(canvas, 'touch', LONG_PRESS_MS);
    expect(types(seen)).not.toContain('longpress');
  });

  it('the native contextmenu a touch hold sends is not a second gesture on the widget', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    hold(canvas, 'touch', LONG_PRESS_MS);
    send(canvas, Object.assign(new Event('contextmenu', { bubbles: true, cancelable: true }), { clientX: 30, clientY: 20 }));
    send(canvas, pointer('pointerup', 'touch', 30, 20));
    expect(types(seen).filter((t) => t === 'longpress' || t === 'contextmenu')).toEqual(['longpress']);
  });
});

describe('a press no click or drag closes', () => {
  it('is canceled when the finger lifts after a long-press, and does not click', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    hold(canvas, 'touch', LONG_PRESS_MS);
    send(canvas, pointer('pointerup', 'touch', 30, 20));
    settle();
    expect(types(seen)).toEqual(['down', 'longpress', 'cancel']);
  });

  it('a tap still ends in up, with no cancel after it', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    send(canvas, pointer('pointerdown', 'touch', 30, 20));
    send(canvas, pointer('pointerup', 'touch', 30, 20));
    settle();
    expect(types(seen)).toEqual(['down', 'up']);
  });

  it('a pointer the browser takes back cancels the press', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    send(canvas, pointer('pointerdown', 'touch', 30, 20));
    send(canvas, pointer('pointercancel', 'touch', 30, 20));
    settle();
    expect(types(seen)).toEqual(['down', 'cancel']);
  });

  it('a second finger joining for a pinch cancels the first one\'s press', async () => {
    const seen: HudPointerEvent[] = [];
    const canvas = await mount(seen);
    send(canvas, pointer('pointerdown', 'touch', 30, 20));
    send(canvas, Object.assign(pointer('pointerdown', 'touch', 150, 150), { pointerId: 8 }));
    send(canvas, Object.assign(pointer('pointerup', 'touch', 150, 150), { pointerId: 8 }));
    send(canvas, pointer('pointerup', 'touch', 30, 20));
    settle();
    expect(types(seen)).toEqual(['down', 'cancel']);
  });
});
