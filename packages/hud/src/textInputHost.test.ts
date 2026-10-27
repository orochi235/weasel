import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createEmitter } from '@weasel-js/registry';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { createPaintedCursorState } from '@weasel-js/core';
import { attachHud } from './attach';
import { createHud, type Hud } from './hud';
import type { HudKeyEvent, HudTextInput, Widget } from './widget';

const theme = resolveTheme(weaselTheme);

function makeApi(element: HTMLElement): CanvasExtensionApi {
  return {
    element, surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 200, height: 200 }),
    clientToWorld: (x: number, y: number): [number, number] => [x, y],
    requestRedraw: vi.fn(), subscribeFrame: vi.fn(() => () => {}), subscribeBeforePaint: vi.fn(() => () => {}),
    subscribeResume: vi.fn(() => () => {}), hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn(() => () => {}),
    getView: vi.fn(() => ({ x: 0, y: 0, scale: { x: 1, y: 1 } })), setView: vi.fn(), subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0), paintedCursor: createPaintedCursorState(),
    cursorSink: { setBase() {}, setOverride() {} }, getDebug: () => null,
  };
}

/** A focusable widget that runs a text edit while `editing` is set, recording keys and composition. */
function editor() {
  const changes = createEmitter();
  const keys: HudKeyEvent[] = [];
  const composed: string[] = [];
  const inserted: string[] = [];
  let editing = false;
  const textInput: HudTextInput = {
    read: () => (editing ? { rect: { x: 30, y: 40, w: 50, h: 20 }, label: 'Name' } : null),
    subscribe: changes.subscribe,
    compose: (t) => { composed.push(t); },
    insert: (t) => { inserted.push(t); },
  };
  const w: Widget = {
    id: 'editor', bounds: { x: 0, y: 0, w: 100, h: 100 }, hidden: false, focusable: true,
    draw: () => [], hitTest: () => true, onPointer: () => {},
    onKey: (e) => { keys.push(e); return true; },
    dispose: () => {},
    textInput,
  };
  const setEditing = (on: boolean) => { editing = on; changes.emit(); };
  return { w, keys, composed, inserted, setEditing };
}

let el: HTMLCanvasElement;
let hud: Hud;
let detach: () => void;
const input = () => document.querySelector<HTMLInputElement>('input[data-weasel-hud="text-input"]')!;

beforeEach(() => {
  el = document.createElement('canvas');
  el.tabIndex = 0;
  document.body.appendChild(el);
  el.focus();
  hud = createHud();
  detach = attachHud(makeApi(el), hud, { font: 'sans-serif', theme });
});

afterEach(() => {
  detach();
  el.remove();
});

describe('the hidden text input', () => {
  it('takes DOM focus from the canvas while the focused widget edits, and gives it back after, the HUD focused throughout', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    expect(document.activeElement).toBe(el);
    e.setEditing(true);
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute('aria-label')).toBe('Name');
    expect(hud.focused).toBe(e.w);
    e.setEditing(false);
    expect(document.activeElement).toBe(el);
    expect(hud.focused).toBe(e.w);
  });

  it('sits at the edit, offset by the canvas', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 5 } as DOMRect);
    e.setEditing(true);
    expect([input().style.left, input().style.top, input().style.width, input().style.height]).toEqual(['40px', '45px', '50px', '20px']);
  });

  it('hands its keys to the widget, and leaves an input method\'s keys alone', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    e.setEditing(true);
    const down = (init: KeyboardEventInit) => {
      const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      input().dispatchEvent(ev);
      return ev;
    };
    expect(down({ key: 'a' }).defaultPrevented).toBe(true);
    expect(down({ key: 'n', isComposing: true }).defaultPrevented).toBe(false);
    expect(down({ key: 'Process', keyCode: 229 }).defaultPrevented).toBe(false);
    expect(down({ key: 'Dead' }).defaultPrevented).toBe(false);
    expect(e.keys.map((k) => k.key)).toEqual(['a']);
  });

  it('feeds composition to the widget: updates as preedit, the end as text', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    e.setEditing(true);
    input().dispatchEvent(new CompositionEvent('compositionupdate', { data: 'に' }));
    input().dispatchEvent(new CompositionEvent('compositionupdate', { data: 'にほ' }));
    input().value = 'にほん';
    input().dispatchEvent(new CompositionEvent('compositionend', { data: '日本' }));
    expect(e.composed).toEqual(['に', 'にほ']);
    expect(e.inserted).toEqual(['日本']);
    expect(input().value).toBe('');
    input().dispatchEvent(new CompositionEvent('compositionend', { data: '' }));
    expect(e.composed.at(-1)).toBe('');
  });

  it('enters text that arrives with no key, as from a character picker', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    e.setEditing(true);
    input().dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '😀' }));
    expect(e.inserted).toEqual(['😀']);
  });

  it('blurs the HUD when DOM focus leaves the input for anything but the canvas', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    e.setEditing(true);
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    expect(hud.focused).toBeNull();
    other.remove();
  });

  it('does not pull focus in when the canvas does not hold it', () => {
    const e = editor();
    hud.add(e.w);
    hud.focus(e.w);
    el.blur();
    hud.focus(e.w);
    e.setEditing(true);
    expect(document.activeElement).not.toBe(input());
  });

  it('gives focus back to the canvas when focus moves to a widget that is not editing', () => {
    const e = editor();
    const other: Widget = { ...editor().w, id: 'other' };
    hud.add(e.w);
    hud.add(other);
    hud.focus(e.w);
    e.setEditing(true);
    hud.focus(other);
    expect(document.activeElement).toBe(el);
    expect(hud.focused).toBe(other);
  });
});
