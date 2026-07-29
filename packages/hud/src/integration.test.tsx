// packages/hud/src/integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { SceneCanvasApi } from '@weasel-js/core';
import { useHud, useHudTool } from './react';
import { _resetFontRegistryForTests } from '@weasel-js/font';
import { readTokens } from './theme';

const defaultResolved = readTokens(null);

interface HarnessApi {
  press: ReturnType<typeof vi.fn<() => void>>;
  hudRef: { current: ReturnType<typeof useHud> | null };
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
function Harness({ apiOut }: { apiOut: HarnessApi }) {
  const ref = React.useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  const hudTool = useHudTool();
  apiOut.hudRef.current = hud;
  const scene = useScene<Empty>({ items: [] });

  return (
    <SceneCanvas
      ref={ref}
      width={200}
      height={200}
      scene={scene}
      layers={{}}
      ambient={[hudTool]}
    />
  );
}

async function mount(apiOut: HarnessApi) {
  const r = render(<Harness apiOut={apiOut} />);
  await act(async () => {});  // let useHud's attach effect run
  return r;
}

describe('weasel-hud integration', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

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

  it('button picks up --wzl-button-fill set on the canvas element via CSS', async () => {
    const apiOut: HarnessApi = { press: vi.fn(), hudRef: { current: null } };
    const { container } = await mount(apiOut);

    const canvas = container.querySelector('canvas')!;
    canvas.style.setProperty('--wzl-button-fill', '#abcdef');

    let btn!: ReturnType<NonNullable<typeof apiOut.hudRef.current>['button']>;
    act(() => { btn = apiOut.hudRef.current!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' }); });
    const cmds = btn.draw({
      dims: { width: 200, height: 200 },
      defaultFont: 'x',
      tokens: readTokens(canvas),
    });
    const body = cmds.find((c) => c.kind === 'path') as { fill: { color: string } };
    expect(body.fill.color).toBe('#abcdef');
    expect(defaultResolved.buttonFill).not.toBe('#abcdef');
  });
});
