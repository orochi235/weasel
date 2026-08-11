// packages/hud/src/integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import type { BuiltinToolId, SceneCanvasApi, SelectionApi } from '@weasel-js/core';
import { useHud, useHudTool } from './react';
import { _resetFontRegistryForTests } from '@weasel-js/font';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';

const defaultResolved = resolveTheme(weaselTheme, 'dark');

interface HarnessApi {
  press: ReturnType<typeof vi.fn<() => void>>;
  hudRef: { current: ReturnType<typeof useHud> | null };
  sceneRef?: { current: ReturnType<typeof useScene<Empty>> | null };
  selectionRef?: { current: SelectionApi | null };
}

/**
 * jsdom doesn't implement PointerEvent with clientX/clientY via the
 * constructor; `fireEvent.pointerDown` produces a nativeEvent with
 * `clientX: undefined`. Synthesize via Event + Object.assign instead.
 */
function makePointerEvent(type: string, init: Record<string, unknown> = {}): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

interface Empty { id: string }

/**
 * The HUD's input rides the same dispatcher every tool does: its layer's
 * hit-test surfaces a `layer:weasel-hud` affordance, and the ambient
 * `useHudTool()` bindings gate on that.
 */
function Harness(
  { apiOut, initialActiveTool, items }:
  { apiOut: HarnessApi; initialActiveTool?: BuiltinToolId; items?: readonly Empty[] },
) {
  const ref = React.useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  const hudTool = useHudTool();
  apiOut.hudRef.current = hud;
  const scene = useScene<Empty>({ items: items ?? [] });
  if (apiOut.sceneRef) apiOut.sceneRef.current = scene;
  const selection = useSelection();
  if (apiOut.selectionRef) apiOut.selectionRef.current = selection;

  return (
    <SceneCanvas
      ref={ref}
      width={200}
      height={200}
      scene={scene}
      selection={selection}
      layers={{}}
      ambient={[hudTool]}
      {...(initialActiveTool
        ? { initialActiveTool, defaultTools: ['select', initialActiveTool] }
        : {})}
    />
  );
}

async function mount(
  apiOut: HarnessApi,
  opts: { initialActiveTool?: BuiltinToolId; items?: readonly Empty[] } = {},
) {
  const r = render(<Harness apiOut={apiOut} initialActiveTool={opts.initialActiveTool} items={opts.items} />);
  await act(async () => {});  // let useHud's attach effect run
  return r;
}

beforeEach(() => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
  global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
});

describe('weasel-hud integration', () => {
  it('pressing a button widget fires its press handler', async () => {
    const api: HarnessApi = { press: vi.fn<() => void>(), hudRef: { current: null } };
    const { container } = await mount(api);

    expect(api.hudRef.current).not.toBeNull();
    let btn!: ReturnType<NonNullable<typeof api.hudRef.current>['button']>;
    act(() => { btn = api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' }); });
    btn.on('press', api.press);

    const canvas = container.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 30, clientY: 20 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 20 }));
    });

    expect(api.press).toHaveBeenCalledTimes(1);
  });

  it('a press outside every widget does not reach the HUD', async () => {
    const api: HarnessApi = { press: vi.fn<() => void>(), hudRef: { current: null } };
    const { container } = await mount(api);

    let btn!: ReturnType<NonNullable<typeof api.hudRef.current>['button']>;
    act(() => { btn = api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' }); });
    btn.on('press', api.press);

    const canvas = container.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 150, clientY: 150 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 150, clientY: 150 }));
    });

    expect(api.press).not.toHaveBeenCalled();
  });

  it('a hidden widget is not pressable', async () => {
    const api: HarnessApi = { press: vi.fn<() => void>(), hudRef: { current: null } };
    const { container } = await mount(api);

    let btn!: ReturnType<NonNullable<typeof api.hudRef.current>['button']>;
    act(() => { btn = api.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' }); });
    btn.on('press', api.press);
    act(() => { btn.setHidden(true); });

    const canvas = container.querySelector('canvas')!;
    act(() => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 30, clientY: 20 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 20 }));
    });

    expect(api.press).not.toHaveBeenCalled();
  });

  it('draws from the theme it is handed, not from CSS on the canvas element', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut);

    // The pre-Plan-B HUD read this back through getComputedStyle. It no longer
    // does, deliberately: the resolved theme is the single input, which is what
    // lets a HUD drawn headlessly be themed the same way a browser one is.
    const canvas = container.querySelector('canvas')!;
    canvas.style.setProperty('--wzl-surface-raised', '#abcdef');

    let btn!: ReturnType<NonNullable<typeof apiOut.hudRef.current>['button']>;
    act(() => { btn = apiOut.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' }); });

    const themed = { ...defaultResolved, '--wzl-surface-raised': '#abcdef' };
    const withTheme = btn.draw({ dims: { width: 200, height: 200 }, defaultFont: 'x', tokens: themed });
    const themedBody = withTheme.find((c) => c.kind === 'path') as { fill: { color: string } };
    expect(themedBody.fill.color).toBe('#abcdef');

    const withoutTheme = btn.draw({ dims: { width: 200, height: 200 }, defaultFont: 'x', tokens: defaultResolved });
    const plainBody = withoutTheme.find((c) => c.kind === 'path') as { fill: { color: string } };
    expect(plainBody.fill.color).not.toBe('#abcdef');
    expect(plainBody.fill.color).toBe(defaultResolved['--wzl-surface-raised']);
  });
});

describe('a HUD window is reachable while a drawing tool is active', () => {
  it('drags the window instead of starting a rect insert', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null }, sceneRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    let win!: ReturnType<NonNullable<typeof apiOut.hudRef.current>['window']>;
    await act(async () => {
      win = apiOut.hudRef.current!.window({ id: 'w1', x: 20, y: 20, w: 100, h: 80, title: 'Loupe' });
    });

    const canvas = container.querySelector('canvas')!;
    // Press on the titlebar, drag 30px right and down, release. Both axes move
    // so a rect that did get inserted would be non-degenerate and countable.
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 60, clientY: 26 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 90, clientY: 56 }));
      canvas.dispatchEvent(makePointerEvent('pointerup',   { clientX: 90, clientY: 56 }));
    });

    expect(win.bounds.x).toBe(50);
    expect(win.bounds.y).toBe(50);
    expect(apiOut.sceneRef!.current!.nodes.size).toBe(0);
  });

  // Unlike the rect test above (select never mounts there), select is active
  // here, so areaSelect's plain `target: 'empty'` binding is in the pool.
  it('drags the window instead of running a marquee, with select active', async () => {
    const apiOut: HarnessApi = {
      press: vi.fn(), hudRef: { current: null }, sceneRef: { current: null }, selectionRef: { current: null },
    };
    const { container } = await mount(apiOut, { initialActiveTool: 'select', items: [{ id: 'n1' }] });
    const nodeId = apiOut.sceneRef!.current!.roots[0];
    act(() => { apiOut.selectionRef!.current!.set([nodeId]); });

    let win!: ReturnType<NonNullable<typeof apiOut.hudRef.current>['window']>;
    await act(async () => {
      win = apiOut.hudRef.current!.window({ id: 'w1', x: 20, y: 20, w: 100, h: 80, title: 'Loupe' });
    });

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 60, clientY: 26 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 90, clientY: 56 }));
      canvas.dispatchEvent(makePointerEvent('pointerup',   { clientX: 90, clientY: 56 }));
    });

    expect(win.bounds.x).toBe(50);
    expect(win.bounds.y).toBe(50);
    // A marquee over this rect with nothing under it would replace the
    // selection with []. It staying put means no marquee ran.
    expect(apiOut.selectionRef!.current!.get()).toEqual([nodeId]);
  });

  it('hovering a resize band sets the matching cursor', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    await act(async () => {
      apiOut.hudRef.current!.window({ id: 'w1', x: 20, y: 20, w: 100, h: 80, title: 'Loupe' });
    });

    const canvas = container.querySelector('canvas')!;
    // (117, 97) is inside the 6px grab band on both the east and south edges.
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 117, clientY: 97 }));
    });
    expect(canvas.style.cursor).toBe('nwse-resize');

    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 60, clientY: 97 }));
    });
    expect(canvas.style.cursor).toBe('ns-resize');

    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 60, clientY: 26 }));
    });
    expect(canvas.style.cursor).toBe('move');
  });

  it('a titlebar-less window reports move over the interior that drags it', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    await act(async () => {
      apiOut.hudRef.current!.window({
        id: 'w1', x: 20, y: 20, w: 100, h: 80, title: 'Loupe', titlebar: false,
      });
    });

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 60, clientY: 60 }));
    });
    expect(canvas.style.cursor).toBe('move');
  });
});

describe('decorative widgets stay transparent to input', () => {
  it('a rect backdrop covering the canvas does not block a rect-tool drag', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null }, sceneRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    await act(async () => {
      apiOut.hudRef.current!.rect({ id: 'dim', x: 0, y: 0, w: 200, h: 200, fill: '#0008' });
    });

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 60, clientY: 26 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 90, clientY: 56 }));
      canvas.dispatchEvent(makePointerEvent('pointerup',   { clientX: 90, clientY: 56 }));
    });

    expect(apiOut.sceneRef!.current!.nodes.size).toBe(1);
  });

  it('a button beneath that backdrop still receives the press', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut, { initialActiveTool: 'rect' });

    await act(async () => {
      const btn = apiOut.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });
      btn.on('press', apiOut.press);
      // Added after the button, so it sits above it in the hit-test walk.
      apiOut.hudRef.current!.rect({ id: 'dim', x: 0, y: 0, w: 200, h: 200, fill: '#0008' });
    });

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 30, clientY: 20 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 20 }));
    });

    expect(apiOut.press).toHaveBeenCalledTimes(1);
  });
});
