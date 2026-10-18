import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { createMenuHost, type MenuHost } from '@weasel-js/routing';
import { createPaintedCursorState, type CanvasExtensionApi, type RenderLayer } from '@weasel-js/core';
import { FIXTURE_FONT, registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
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
  h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
  return h;
}

const focusableWidget = (id: string): Widget => ({
  id, bounds: { x: 700, y: 0, w: 20, h: 20 }, hidden: false, focusable: true,
  draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
});

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

  it('closes the host when the menu cannot take focus', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hud.bind({ requestRedraw() {}, registerLayer: () => () => {}, subscribeFrame: () => () => {} });
    hud.unbind();
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    expect(hud.widgets()).toHaveLength(0);
    expect(host.current()).toBeNull();
    warn.mockRestore();
  });

  it('closes on a wheel outside the menu, and not on one over it', () => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    window.dispatchEvent(new WheelEvent('wheel', { clientX: 20, clientY: 20 }));
    expect(host.current()).not.toBeNull();
    window.dispatchEvent(new WheelEvent('wheel', { clientX: 600, clientY: 500 }));
    expect(host.current()).toBeNull();
  });

  it.each(['blur', 'resize'])('closes on window %s', (type) => {
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    window.dispatchEvent(new Event(type));
    expect(host.current()).toBeNull();
  });

  it('stops listening to the window once detached', () => {
    detach();
    detach = () => {};
    const close = vi.spyOn(host, 'close');
    window.dispatchEvent(new Event('resize'));
    expect(close).not.toHaveBeenCalled();
  });

  it('gives focus back to the widget that held it when the menu closes', () => {
    const other = focusableWidget('other');
    hud.add(other);
    hud.focus(other, { visible: true });
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    host.close();
    expect(hud.focused).toBe(other);
    expect(hud.focusVisible).toBe(true);
  });

  it('keeps that widget through a second open', () => {
    const other = focusableWidget('other');
    hud.add(other);
    hud.focus(other);
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    host.open({ menu: 'row', client: { x: 50, y: 50 } });
    host.close();
    expect(hud.focused).toBe(other);
  });

  it('leaves focus where a press moved it', () => {
    const other = focusableWidget('other');
    const pressed = focusableWidget('pressed');
    hud.add(other);
    hud.add(pressed);
    hud.focus(other);
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    hud.focus(pressed);
    expect(host.current()).toBeNull();
    expect(hud.focused).toBe(pressed);
  });

  it('does not give focus to a widget removed while the menu was open', () => {
    const other = focusableWidget('other');
    hud.add(other);
    hud.focus(other);
    host.open({ menu: 'row', client: { x: 10, y: 10 } });
    hud.remove(other);
    host.close();
    expect(hud.focused).toBeNull();
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

let layer: RenderLayer<unknown> | undefined;

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
    registerLayer: vi.fn((l: RenderLayer<unknown>) => { layer = l; return () => {}; }),
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

  it('mirrors the open menu as hidden DOM with menu roles, kept in step with its highlight', () => {
    const mirror = document.querySelector<HTMLElement>('[role="menu"][aria-label="Context menu"]');
    expect(mirror).not.toBeNull();
    expect(el.getAttribute('aria-owns')).toBe(mirror!.id);
    const row = mirror!.querySelector<HTMLElement>('[role="menuitem"]')!;
    expect(row.textContent).toBe('Cut');
    expect(el.getAttribute('aria-activedescendant')).toBeNull();
    keydown(el, 'ArrowDown');
    expect(mirror!.getAttribute('aria-activedescendant')).toBe(row.id);
    expect(el.getAttribute('aria-activedescendant')).toBe(row.id);
    keydown(el, 'Escape');
    expect(document.querySelector('[role="menu"][aria-label="Context menu"]')).toBeNull();
    expect(el.getAttribute('aria-owns')).toBeNull();
    expect(el.getAttribute('aria-activedescendant')).toBeNull();
  });
});

describe('attachMenuHost with a hud drawing in another font', () => {
  const realFetch = global.fetch;
  const realBitmap = global.createImageBitmap;
  afterEach(() => {
    _resetFontRegistryForTests();
    global.fetch = realFetch;
    global.createImageBitmap = realBitmap;
  });

  it('measures its labels in the hud\'s font', async () => {
    global.fetch = vi.fn(async (url: string) => (url.endsWith('.json')
      ? { ok: true, json: async () => FIXTURE_FONT }
      : { ok: true, blob: async () => new Blob(['PNG'], { type: 'image/png' }) })) as never;
    global.createImageBitmap = vi.fn(async () => ({ width: 512, height: 512, close() {} })) as never;
    await registerFont('Fixture Face', {}, '/fixture.json', '/fixture.png');
    const label = 'A'.repeat(20);
    const wide = createMenuHost({
      actions: () => [{ id: 'a', label, invoker: immediate }],
      depsFor: () => undefined, trigger, activeTool: () => null,
    });
    wide.define({ id: 'wide', menu: pref.group('', { a: pref.action('a') }) });
    const el = document.createElement('canvas');
    const own = createHud();
    const unhud = attachHud(makeApi(el), own, { font: 'Fixture Face', theme: resolveTheme(weaselTheme) });
    const off = attachMenuHost(own, wide, { toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }) });
    wide.open({ menu: 'wide', client: { x: 10, y: 10 } });
    layer!.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 800, height: 600 });
    const advance = FIXTURE_FONT.chars[0]!.xadvance;
    expect(own.widgets()[0]!.bounds.w).toBe(Math.ceil(20 * advance * 13 / FIXTURE_FONT.info.size) + 16 + 48);
    off();
    unhud();
  });
});
