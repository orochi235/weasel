/**
 * A HUD menu's text row typed into from real key events, in a real browser: DOM focus moves to the hidden input
 * the edit types through and back, and the HUD keeps focus the whole time. jsdom's focus model is what the unit
 * tests rest on; this checks Chromium's. No input method can be driven headlessly, so composition here is
 * dispatched, not typed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { CanvasExtensionApi, OpenMenu } from '@weasel-js/core';
import { createPaintedCursorState } from '@weasel-js/core';
import type { MenuTextEntry } from '@weasel-js/menu';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { attachHud } from '../attach';
import { createHud, type Hud } from '../hud';
import type { Widget } from '../widget';
import { createMenuWidget } from './menuWidget';

function makeApi(element: HTMLElement): CanvasExtensionApi {
  return {
    element, surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 400, height: 300 }),
    clientToWorld: (x: number, y: number): [number, number] => [x, y],
    requestRedraw: vi.fn(), subscribeFrame: vi.fn(() => () => {}), subscribeBeforePaint: vi.fn(() => () => {}),
    subscribeResume: vi.fn(() => () => {}), hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn(() => () => {}),
    getView: vi.fn(() => ({ x: 0, y: 0, scale: { x: 1, y: 1 } })), setView: vi.fn(), subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0), paintedCursor: createPaintedCursorState(),
    cursorSink: { setBase() {}, setOverride() {} }, getDebug: () => null,
  };
}

let el: HTMLCanvasElement;
let hud: Hud;
let detach: () => void;
let menu: Widget;
let row: MenuTextEntry;
const input = () => document.querySelector<HTMLInputElement>('input[data-weasel-hud="text-input"]')!;

beforeEach(() => {
  el = document.createElement('canvas');
  el.tabIndex = 0;
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '400px', height: '300px' });
  document.body.appendChild(el);
  el.focus();
  hud = createHud();
  detach = attachHud(makeApi(el), hud, { font: 'sans-serif', theme: resolveTheme(weaselTheme) });
  row = { kind: 'text', key: 'name', label: 'Name', value: 'Layer', set: vi.fn() };
  const open: OpenMenu = { seq: 1, source: 'keyboard', client: { x: 10, y: 10 }, entries: [row] };
  menu = createMenuWidget({
    open, close: () => {}, toCanvas: (p) => p, canvasSize: () => ({ width: 400, height: 300 }),
    measure: (t) => Array.from(t).length * 7, onChange: () => {},
  });
  hud.add(menu);
  hud.focus(menu);
});

afterEach(() => {
  detach();
  el.remove();
});

describe('a HUD menu text row in a browser', () => {
  it('types through the hidden input with the HUD focused, and hands DOM focus back to the canvas on Enter', async () => {
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(input());
    await userEvent.keyboard('ab');
    expect(input().value).toBe('');
    expect(hud.focused).toBe(menu);
    input().dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    input().dispatchEvent(new CompositionEvent('compositionupdate', { data: 'に' }));
    input().dispatchEvent(new CompositionEvent('compositionend', { data: '日' }));
    await userEvent.keyboard('{Alt>}{Backspace}{/Alt}');
    await userEvent.keyboard('c{Enter}');
    expect(row.set).toHaveBeenCalledExactlyOnceWith('c');
    expect(document.activeElement).toBe(el);
    expect(hud.focused).toBe(menu);
  });

  it('keeps DOM focus with the edit across a press on the menu', async () => {
    await userEvent.keyboard('{Enter}');
    const b = menu.bounds;
    await userEvent.click(el, { position: { x: b.x + 20, y: b.y + b.h / 2 } });
    expect(hud.focused).toBe(menu);
    expect(document.activeElement).toBe(input());
    await userEvent.keyboard('!{Enter}');
    expect(row.set).toHaveBeenCalledExactlyOnceWith('Layer!');
  });
});
