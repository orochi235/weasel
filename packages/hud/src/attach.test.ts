import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { attachHud } from './attach';
import { createHud } from './hud';
import type {
  CanvasExtensionApi,
  ClaimableGesture,
  LayerHit,
  RenderLayer,
} from '@weasel-js/core';
import { DEFAULT_WIDGET_CLAIMS, type Widget } from './widget';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';

const IDENTITY_VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function makeApi(): CanvasExtensionApi & { _layer?: RenderLayer<unknown> } {
  const api: CanvasExtensionApi & { _layer?: RenderLayer<unknown> } = {
    element: null,
    surface: null,
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn((layer: RenderLayer<unknown>) => {
      api._layer = layer;
      return () => { api._layer = undefined; };
    }),
    getView: vi.fn(() => IDENTITY_VIEW),
    setView: vi.fn(),
    subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0),
  };
  return api;
}

describe('attachHud', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    // Stub fetch so registerDefaultFont's promise resolves
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    // Stub createImageBitmap (jsdom doesn't implement it)
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

  it('registers a screen-space layer on the canvas', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(api.registerLayer).toHaveBeenCalledTimes(1);
    expect(api._layer?.space).toBe('screen');
  });

  it('binds the HUD (hud.attached is true after attach)', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(hud.attached).toBe(true);
  });

  it('returns a detach function that unregisters and unbinds', () => {
    const hud = createHud();
    const api = makeApi();
    const detach = attachHud(api, hud);
    detach();
    expect(hud.attached).toBe(false);
    expect(api._layer).toBeUndefined();
  });

  it('throws if the HUD is already attached', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(() => attachHud(api, hud)).toThrow();
  });

  it('onUncapturedMove fires hovermove on the topmost-hit widget', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    const hoverFn = vi.fn();
    const btn = hud.button({ id: 'b', x: 10, y: 10, w: 50, h: 20, label: 'x' });
    btn.on('hover', hoverFn);

    // Simulate the canvas dispatching onUncapturedMove under identity view
    // (worldX/Y = canvas pixels).
    api._layer!.onUncapturedMove!(20, 15, {} as PointerEvent, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    expect(hoverFn).toHaveBeenCalledTimes(1);
  });

  it('fires hovermove for every move inside a widget, not only on entry', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    const seen: { x: number; y: number }[] = [];
    hud.add({
      id: 'w', bounds: { x: 0, y: 0, w: 100, h: 100 }, hidden: false,
      draw: () => [], hitTest: () => true, dispose: () => {},
      onPointer: (e) => { if (e.type === 'hovermove') seen.push({ x: e.x, y: e.y }); },
    });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    api._layer!.onUncapturedMove!(10, 10, {} as PointerEvent, view, { width: 100, height: 100 });
    api._layer!.onUncapturedMove!(40, 60, {} as PointerEvent, view, { width: 100, height: 100 });
    expect(seen).toEqual([{ x: 10, y: 10 }, { x: 40, y: 60 }]);
  });

  it('detach sends hoverleave so a widget is not stranded hovered', () => {
    const hud = createHud();
    const api = makeApi();
    const detach = attachHud(api, hud);
    const types: string[] = [];
    hud.add({
      id: 'w', bounds: { x: 0, y: 0, w: 100, h: 100 }, hidden: false,
      draw: () => [], hitTest: () => true, dispose: () => {},
      onPointer: (e) => { types.push(e.type); },
    });
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    api._layer!.onUncapturedMove!(10, 10, {} as PointerEvent, view, { width: 100, height: 100 });
    detach();
    expect(types).toEqual(['hovermove', 'hoverleave']);
  });

  it('layer.draw draws with the theme passed to attachHud', () => {
    const hud = createHud();
    const canvas = document.createElement('canvas');
    // Set the property the pre-Plan-B implementation would have read back.
    // It must NOT reach the HUD any more — the theme argument is the only input.
    canvas.style.setProperty('--wzl-surface-raised', '#abcdef');
    document.body.appendChild(canvas);
    try {
      const api: CanvasExtensionApi = {
        element: canvas,
        surface: canvas,
        requestRedraw: vi.fn(),
        subscribeFrame: vi.fn(() => () => {}),
        hitTestExtras: vi.fn(() => null),
        registerLayer: vi.fn(() => () => {}),
        getView: vi.fn(() => IDENTITY_VIEW),
        setView: vi.fn(),
        subscribeView: vi.fn(() => () => {}),
        getPaintedVersion: vi.fn(() => 0),
      };
      const theme = { ...resolveTheme(weaselTheme, 'dark'), '--wzl-surface-raised': '#123456' };
      attachHud(api, hud, { theme });
      hud.button({ id: 'b', x: 0, y: 0, w: 50, h: 20, label: 'x' });
      const registeredLayer = (api.registerLayer as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const cmds = registeredLayer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
      const buttonBody = cmds.find((c: { kind: string }) => c.kind === 'path') as { fill: { color: string } };
      expect(buttonBody.fill.color).toBe('#123456');
    } finally {
      canvas.remove();
    }
  });

  it('defaults to the built-in theme when none is passed', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.button({ id: 'b', x: 0, y: 0, w: 50, h: 20, label: 'x' });
    const registeredLayer = (api.registerLayer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cmds = registeredLayer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    const buttonBody = cmds.find((c: { kind: string }) => c.kind === 'path') as { fill: { color: string } };
    expect(buttonBody.fill.color).toBe(resolveTheme(weaselTheme, 'dark')['--wzl-surface-raised']);
  });

  it('draws content beneath frames, clipped to contentRect', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    const layer = api._layer!;

    const win = hud.window({
      id: 'w', x: 10, y: 10, w: 100, h: 80, title: 'T',
      content: () => [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 5, height: 5 },
        fill: { fill: 'solid', color: '#f00' },
      }],
    });

    const cmds = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });
    expect(cmds[0].kind).toBe('group');
    expect((cmds[0] as { clip?: unknown }).clip).toMatchObject({
      kind: 'rect',
      x: win.contentRect.x, y: win.contentRect.y,
      width: win.contentRect.w, height: win.contentRect.h,
    });
    expect(cmds.length).toBeGreaterThan(1);   // frame commands follow
  });

  it('draws every content pass before any frame, across windows', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    const layer = api._layer!;

    const painter = () => [{
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 },
      fill: { fill: 'solid' as const, color: '#f00' },
    }];
    hud.window({ id: 'a', x: 10, y: 10, w: 100, h: 80, title: 'A', content: painter });
    hud.window({ id: 'b', x: 200, y: 10, w: 100, h: 80, title: 'B', content: painter });

    const kinds = layer
      .draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 })
      .map((c) => c.kind);
    // Interleaving per widget (content, frame, content, frame) would let the
    // second window's content paint over the first window's border.
    expect(kinds.slice(0, 2)).toEqual(['group', 'group']);
    expect(kinds.indexOf('path')).toBeGreaterThan(kinds.lastIndexOf('group'));
  });
});

describe('attachHud claims', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

  const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const DIMS = { width: 100, height: 100 };

  function widgetAt(id: string, claims?: readonly ClaimableGesture[]): Widget {
    return {
      id,
      bounds: { x: 0, y: 0, w: 50, h: 50 },
      hidden: false,
      draw: () => [],
      hitTest: () => true,
      ...(claims !== undefined ? { claims } : {}),
      onPointer: () => {},
      dispose: () => {},
    };
  }

  function hitAt(api: ReturnType<typeof makeApi>) {
    return api._layer!.hitTest!(10, 10, undefined, IDENTITY, DIMS) as
      (LayerHit<{ widget: Widget }> & { claimedKinds?: readonly ClaimableGesture[] }) | null;
  }

  it('the hit walk descends past a widget that claims nothing', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('under'));
    hud.add(widgetAt('decoration', []));
    expect(hitAt(api)?.initialScratch?.widget.id).toBe('under');
  });

  it('the layer hit carries the widget claim set', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('scroller', ['pointer', 'wheel']));
    expect(hitAt(api)?.claimedKinds).toEqual(['pointer', 'wheel']);
  });

  it('a widget declaring nothing carries the default claim set', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('plain'));
    expect(hitAt(api)?.claimedKinds).toEqual(DEFAULT_WIDGET_CLAIMS);
  });

  it('a widget that claims the pointer reports a pointer cursor by default', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('plain'));
    expect(hitAt(api)?.cursor).toBe('pointer');
  });

  it('a widget that claims no pointer gesture reports no cursor', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('scroller', ['wheel']));
    expect(hitAt(api)?.cursor).toBeUndefined();
  });

  it('a widget’s own cursorAt beats the default', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add({ ...widgetAt('resizer'), cursorAt: () => 'nwse-resize' });
    expect(hitAt(api)?.cursor).toBe('nwse-resize');
  });

  it('a HUD of nothing but decoration produces no hit at all', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    hud.add(widgetAt('decoration', []));
    expect(hitAt(api)).toBeNull();
  });
});
