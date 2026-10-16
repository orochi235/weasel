import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuHost, type MenuHost } from '@weasel-js/routing';
import { createPaintedCursorState, type CanvasExtensionApi } from '@weasel-js/core';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { attachHud } from '../attach';
import { createHud, type Hud } from '../hud';
import type { Widget } from '../widget';
import { attachMenuHost } from './attachMenuHost';

const trigger = vi.fn<(id: string, params?: Record<string, unknown>) => boolean>(() => true);
const immediate = { timing: 'immediate' as const, run: () => {} };

function makeHost(): MenuHost {
  const h = createMenuHost({
    actions: () => [{ id: 'cut', label: 'Cut', invoker: immediate }],
    depsFor: () => undefined, trigger, activeTool: () => null,
  });
  h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
  return h;
}

const opts = { toCanvas: (p: { x: number; y: number }) => p, canvasSize: () => ({ width: 800, height: 600 }), measure: () => 40 };

let hud: Hud;
let host: MenuHost;
let detach: () => void;

beforeEach(() => {
  trigger.mockClear();
  hud = createHud();
  host = makeHost();
  detach = attachMenuHost(hud, host, opts);
});
afterEach(() => detach());

describe('attachMenuHost', () => {
  it('adds a focused menu widget when the host opens', () => {
    const focused = vi.fn();
    hud.subscribeFocus(focused);
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    expect(hud.widgets()).toHaveLength(1);
    const w = hud.widgets()[0]!;
    expect(hud.focused).toBe(w);
    expect(focused).toHaveBeenLastCalledWith(w);
  });

  it('removes and disposes the widget when the host closes', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    const w = hud.widgets()[0]!;
    host.close();
    expect(hud.widgets()).toHaveLength(0);
    expect(w.disposed).toBe(true);
  });

  it('replaces the widget on a second open without closing the new menu', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    const first = hud.widgets()[0]!;
    host.open({ menu: 'row', client: { x: 50, y: 50 } });
    expect(hud.widgets()).toHaveLength(1);
    expect(hud.widgets()[0]).not.toBe(first);
    expect(first.disposed).toBe(true);
    expect(host.current()).not.toBeNull();
    expect(hud.focused).toBe(hud.widgets()[0]);
  });

  it('closes when focus leaves the menu', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    hud.focus(null);
    expect(host.current()).toBeNull();
    expect(hud.widgets()).toHaveLength(0);
  });

  it('runs a chosen item and closes', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    const w = hud.widgets()[0]!;
    w.onPointer({ type: 'down', x: 20, y: 20, native: null });
    w.onPointer({ type: 'up', x: 20, y: 20, native: null });
    expect(trigger).toHaveBeenCalledWith('cut', expect.anything());
    expect(host.current()).toBeNull();
    expect(hud.widgets()).toHaveLength(0);
  });

  it('a stale widget closing does not close a newer menu', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    const first = hud.widgets()[0]!;
    host.open({ menu: 'row', client: { x: 50, y: 50 } });
    first.onKey!({
      type: 'keydown', key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false,
      shiftKey: false, repeat: false, native: null,
    });
    expect(host.current()).not.toBeNull();
  });

  it('detaching removes the widget and stops following the host', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    detach();
    expect(hud.widgets()).toHaveLength(0);
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    expect(hud.widgets()).toHaveLength(0);
    detach = () => {};
  });
});

function makeApi(element: HTMLElement): CanvasExtensionApi {
  return {
    element,
    surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    clientToWorld: (x: number, y: number): [number, number] => [x, y],
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    subscribeBeforePaint: vi.fn(() => () => {}),
    subscribeResume: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn(() => () => {}),
    getView: vi.fn(() => ({ x: 0, y: 0, scale: { x: 1, y: 1 } })),
    setView: vi.fn(),
    subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0),
    paintedCursor: createPaintedCursorState(),
    cursorSink: { setBase() {}, setOverride() {} },
    getDebug: () => null,
  };
}

function pointerdown(el: HTMLElement, x: number, y: number): void {
  const ev = new Event('pointerdown', { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  el.dispatchEvent(ev);
}

function keydown(el: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

describe('attachMenuHost on an attached hud', () => {
  let el: HTMLCanvasElement;
  let unhud: () => void;

  beforeEach(() => {
    el = document.createElement('canvas');
    el.tabIndex = 0;
    document.body.appendChild(el);
    el.focus();
    unhud = attachHud(makeApi(el), hud, { font: 'sans-serif', theme: resolveTheme(weaselTheme) });
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
  });
  afterEach(() => { unhud(); el.remove(); });

  const menu = (): Widget | undefined => hud.widgets()[0];

  it('a press on the menu keeps it open', () => {
    pointerdown(el, 20, 20);
    expect(host.current()).not.toBeNull();
  });

  it('a press on the scene closes it', () => {
    pointerdown(el, 400, 400);
    expect(host.current()).toBeNull();
    expect(menu()).toBeUndefined();
  });

  it('a press on another focusable widget closes it', () => {
    const other: Widget = {
      id: 'other', bounds: { x: 500, y: 0, w: 20, h: 20 }, hidden: false, focusable: true,
      draw: () => [], hitTest: (x, y) => x >= 500 && x < 520 && y < 20, onPointer: () => {}, dispose: () => {},
    };
    hud.add(other);
    pointerdown(el, 510, 10);
    expect(host.current()).toBeNull();
  });

  it('Escape closes it, and the canvas never sees the key', () => {
    const ev = keydown(el, 'Escape');
    expect(ev.defaultPrevented).toBe(true);
    expect(host.current()).toBeNull();
  });

  it('a modified key is swallowed but leaves the menu open', () => {
    const ev = keydown(el, 'z', { ctrlKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(host.current()).not.toBeNull();
  });
});
