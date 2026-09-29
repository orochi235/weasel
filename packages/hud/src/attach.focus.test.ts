import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { CanvasExtensionApi, RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { createPaintedCursorState } from '@weasel-js/core';
import { attachHud } from './attach';
import { createHud, type Hud } from './hud';
import type { HudKeyEvent, Widget } from './widget';

const IDENTITY_VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const theme = resolveTheme(weaselTheme);

function makeApi(element: HTMLElement): CanvasExtensionApi & { _layer?: RenderLayer<unknown> } {
  const api: CanvasExtensionApi & { _layer?: RenderLayer<unknown> } = {
    element,
    surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 200, height: 200 }),
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    subscribeBeforePaint: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn((layer: RenderLayer<unknown>) => {
      api._layer = layer;
      return () => { api._layer = undefined; };
    }),
    getView: vi.fn(() => IDENTITY_VIEW),
    setView: vi.fn(),
    subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0),
    paintedCursor: createPaintedCursorState(),
    getDebug: () => null,
  };
  return api;
}

/** A focusable box at `x`, 20px square, recording the keys it is handed. */
function box(id: string, x: number, handles: readonly string[] = [], extra: Partial<Widget> = {}) {
  const keys: HudKeyEvent[] = [];
  const w: Widget = {
    id, bounds: { x, y: 0, w: 20, h: 20 }, hidden: false, focusable: true,
    accessibleName: `${id} box`,
    draw: () => [],
    hitTest: (px, py) => px >= x && px < x + 20 && py >= 0 && py < 20,
    onPointer: () => {},
    onKey: (e) => { keys.push(e); return handles.includes(e.key); },
    dispose: () => {},
    ...extra,
  };
  return { w, keys };
}

function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}, type = 'keydown'): KeyboardEvent {
  const ev = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev;
}

function press(el: HTMLElement, x: number, y: number): void {
  const ev = new Event('pointerdown', { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  el.dispatchEvent(ev);
}

let el: HTMLCanvasElement;
let hud: Hud;
let api: ReturnType<typeof makeApi>;
let detach: () => void;

beforeEach(() => {
  el = document.createElement('canvas');
  el.tabIndex = 0;
  document.body.appendChild(el);
  el.focus();
  hud = createHud();
  api = makeApi(el);
  detach = attachHud(api, hud, { font: 'sans-serif', theme });
});

afterEach(() => {
  detach();
  el.remove();
});

describe('focus from the pointer', () => {
  it('a press on a focusable widget focuses it, without a ring', () => {
    const a = box('a', 0);
    hud.add(a.w);
    press(el, 5, 5);
    expect(hud.focused).toBe(a.w);
    expect(hud.focusVisible).toBe(false);
  });

  it('a press on empty canvas blurs', () => {
    const a = box('a', 0);
    hud.add(a.w);
    hud.focus(a.w);
    press(el, 150, 150);
    expect(hud.focused).toBeNull();
  });

  it('a press on a widget that is not focusable blurs', () => {
    const a = box('a', 0);
    const plain = box('plain', 40, [], { focusable: false });
    hud.add(a.w);
    hud.add(plain.w);
    hud.focus(a.w);
    press(el, 45, 5);
    expect(hud.focused).toBeNull();
  });

  it('the canvas losing DOM focus blurs the HUD', () => {
    const a = box('a', 0);
    hud.add(a.w);
    hud.focus(a.w);
    el.blur();
    expect(hud.focused).toBeNull();
  });
});

describe('the key arm', () => {
  it('delivers keys to the focused widget', () => {
    const a = box('a', 0, ['Enter']);
    hud.add(a.w);
    hud.focus(a.w);
    key(el, 'Enter', { shiftKey: true });
    key(el, 'Enter', {}, 'keyup');
    expect(a.keys.map((e) => [e.type, e.key, e.shiftKey])).toEqual([
      ['keydown', 'Enter', true],
      ['keyup', 'Enter', false],
    ]);
  });

  it('a handled key is default-prevented, which the canvas key bindings skip', () => {
    const a = box('a', 0, ['Delete']);
    hud.add(a.w);
    hud.focus(a.w);
    expect(key(el, 'Delete').defaultPrevented).toBe(true);
  });

  it('an unhandled key falls through untouched', () => {
    const a = box('a', 0, ['Enter']);
    hud.add(a.w);
    hud.focus(a.w);
    expect(key(el, 'Delete').defaultPrevented).toBe(false);
  });

  it('with nothing focused, no widget hears a key', () => {
    const a = box('a', 0, ['Delete']);
    hud.add(a.w);
    expect(key(el, 'Delete').defaultPrevented).toBe(false);
    expect(a.keys).toEqual([]);
  });

  it('a key on a pointer-focused widget turns its ring on', () => {
    const a = box('a', 0);
    hud.add(a.w);
    press(el, 5, 5);
    key(el, 'x');
    expect(hud.focusVisible).toBe(true);
  });

  it('stops delivering once detached', () => {
    const a = box('a', 0, ['Delete']);
    hud.add(a.w);
    hud.focus(a.w);
    detach();
    detach = () => {};
    expect(key(el, 'Delete').defaultPrevented).toBe(false);
    expect(a.keys).toEqual([]);
  });
});

describe('Tab', () => {
  it('walks the tab order and leaves the canvas past the end', () => {
    const a = box('a', 0);
    const b = box('b', 40);
    hud.add(a.w);
    hud.add(b.w);
    expect(key(el, 'Tab').defaultPrevented).toBe(true);
    expect(hud.focused).toBe(a.w);
    expect(hud.focusVisible).toBe(true);
    expect(key(el, 'Tab').defaultPrevented).toBe(true);
    expect(hud.focused).toBe(b.w);
    // Not prevented: the browser moves focus on to the next element.
    expect(key(el, 'Tab').defaultPrevented).toBe(false);
    expect(hud.focused).toBeNull();
  });

  it('Shift+Tab walks back to the canvas itself, then leaves', () => {
    const a = box('a', 0);
    const b = box('b', 40);
    hud.add(a.w);
    hud.add(b.w);
    hud.focus(b.w);
    expect(key(el, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(hud.focused).toBe(a.w);
    expect(key(el, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(hud.focused).toBeNull();
    expect(key(el, 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
  });

  it('a widget that handles Tab keeps it', () => {
    const a = box('a', 0, ['Tab']);
    const b = box('b', 40);
    hud.add(a.w);
    hud.add(b.w);
    hud.focus(a.w);
    key(el, 'Tab');
    expect(hud.focused).toBe(a.w);
  });

  it('Tab with a command modifier is not focus navigation', () => {
    hud.add(box('a', 0).w);
    expect(key(el, 'Tab', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(hud.focused).toBeNull();
  });

  it('with no focusable widgets, Tab is the browser\'s', () => {
    expect(key(el, 'Tab').defaultPrevented).toBe(false);
  });
});

describe('focus ring', () => {
  const draw = (): DrawCommand[] => api._layer!.draw(null, IDENTITY_VIEW, { width: 200, height: 200 }) as DrawCommand[];
  const ringColor = theme['--wzl-focus-ring'];
  const rings = () => draw().filter((c) =>
    c.kind === 'path' && c.stroke?.paint?.fill === 'solid' && c.stroke.paint.color === ringColor);

  it('paints around the focused widget in the focus-ring token when visible', () => {
    const a = box('a', 40);
    hud.add(a.w);
    hud.focus(a.w, { visible: true });
    const found = rings();
    expect(found).toHaveLength(1);
    const path = (found[0] as { path: { kind: string; x: number; y: number; width: number; height: number } }).path;
    expect(path.kind).toBe('rect');
    // Outset from the bounds so it does not cover the widget's own edge.
    expect(path.x).toBeLessThan(40);
    expect(path.x + path.width).toBeGreaterThan(60);
  });

  it('paints nothing for pointer focus, or with nothing focused', () => {
    const a = box('a', 40);
    hud.add(a.w);
    expect(rings()).toHaveLength(0);
    hud.focus(a.w, { visible: false });
    expect(rings()).toHaveLength(0);
  });

  it('paints above every widget frame', () => {
    const a = box('a', 0, [], {
      draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 }, fill: { fill: 'solid', color: '#123456' } }],
    });
    hud.add(a.w);
    hud.add(box('b', 10, [], {
      draw: () => [{ kind: 'path', path: { kind: 'rect', x: 10, y: 0, width: 20, height: 20 }, fill: { fill: 'solid', color: '#654321' } }],
    }).w);
    hud.focus(a.w, { visible: true });
    const cmds = draw();
    const last = cmds[cmds.length - 1] as { stroke?: { paint: { color: string } } };
    expect(last.stroke?.paint.color).toBe(ringColor);
  });
});

describe('assistive tech', () => {
  const region = () => document.querySelector('[aria-live]');

  it('announces the focused widget through a polite live region', () => {
    const a = box('a', 0);
    hud.add(a.w);
    expect(region()?.getAttribute('aria-live')).toBe('polite');
    hud.focus(a.w);
    expect(region()?.textContent).toBe('a box');
    hud.focus(null);
    expect(region()?.textContent).toBe('');
  });

  it('removes the region on detach', () => {
    detach();
    detach = () => {};
    expect(region()).toBeNull();
  });
});
