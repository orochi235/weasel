// The menu widget behind the real dispatcher: what reaches it from a mouse, not from a hand-built event.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { act, render } from '@testing-library/react';
import React from 'react';
import { ActionsProvider, SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import type { MenuHost, SceneCanvasApi, SurfaceContribution } from '@weasel-js/core';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { useHud, useHudContribution } from '../react';
import { attachMenuHost } from './attachMenuHost';

interface Empty { id: string }

const cut = vi.fn();
let depGet: ((name: string) => unknown) | null = null;
const probe: SurfaceContribution = {
  id: 'menu-widget-probe',
  eligibility: { always: true },
  actions: [{ id: 'probe.cut', label: 'Cut', invoker: { timing: 'immediate', run: cut } }],
  menus: [{ id: 'probe.menu', menu: pref.group('', { probe_cut: pref.action('probe.cut') }) }],
  attach: (_api, deps) => { depGet = (name) => deps.get(name as never); return () => {}; },
};

let hudRef: ReturnType<typeof useHud> | null = null;

function Harness() {
  const ref = React.useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  const hudTool = useHudContribution();
  hudRef = hud;
  const scene = useScene<Empty>({ items: [] });
  const selection = useSelection();
  return (
    <ActionsProvider>
      <SceneCanvas
        ref={ref} width={300} height={300} scene={scene} selection={selection} layers={{}}
        ambient={[hudTool, probe]}
      />
    </ActionsProvider>
  );
}

function pointer(canvas: Element, type: string, x: number, y: number, button: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button });
  canvas.dispatchEvent(ev);
}

async function openMenu() {
  const { container } = render(<Harness />);
  await act(async () => {});
  const host = depGet!('menuHost') as MenuHost;
  act(() => {
    attachMenuHost(hudRef!, host, {
      toCanvas: (p) => p, canvasSize: () => ({ width: 300, height: 300 }), measure: () => 40,
    });
    host.open({ menu: 'probe.menu', client: { x: 10, y: 10 } });
  });
  return { canvas: container.querySelector('canvas')!, host };
}

beforeEach(() => {
  cut.mockClear();
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
  global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
});

describe('the HUD menu under the dispatcher', () => {
  it('runs a row on a primary click', async () => {
    const { canvas, host } = await openMenu();
    act(() => {
      pointer(canvas, 'pointerdown', 20, 20, 0);
      pointer(canvas, 'pointerup', 20, 20, 0);
    });
    expect(cut).toHaveBeenCalledTimes(1);
    expect(host.current()).toBeNull();
  });

  it('runs nothing on a right-button press and release over a row', async () => {
    const { canvas, host } = await openMenu();
    act(() => {
      pointer(canvas, 'pointerdown', 20, 20, 2);
      pointer(canvas, 'pointerup', 20, 20, 2);
    });
    expect(cut).not.toHaveBeenCalled();
    expect(host.current()).not.toBeNull();
  });
});
