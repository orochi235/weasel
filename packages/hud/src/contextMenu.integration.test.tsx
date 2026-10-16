// A right-click on a HUD widget stays the widget's: the kit's `menu.context` action must not open a menu.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ActionsProvider, SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import type { SceneCanvasApi, SurfaceContribution } from '@weasel-js/core';
import { useHud, useHudContribution } from './react';
import type { Widget } from './widget';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';

interface Empty { id: string }

const open = vi.fn(() => false);
let depGet: ((name: string) => unknown) | null = null;
const probe: SurfaceContribution = {
  id: 'menu-host-probe',
  eligibility: { always: true },
  actions: [{ id: 'probe.cut', label: 'Cut', invoker: { timing: 'immediate', run: () => {} } }],
  menus: [{ id: 'probe.menu', when: { bodyTarget: 'empty' }, menu: pref.group('', { probe_cut: pref.action('probe.cut') }) }],
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
        ref={ref} width={200} height={200} scene={scene} selection={selection} layers={{}} features={['edit']}
        ambient={[hudTool, probe]}
      />
    </ActionsProvider>
  );
}

const panel: Widget = {
  id: 'panel',
  bounds: { x: 10, y: 10, w: 60, h: 24 },
  hidden: false,
  draw: () => [],
  hitTest: (x, y) => x >= 10 && x < 70 && y >= 10 && y < 34,
  onPointer: () => {},
  dispose: () => {},
};

function rightClick(canvas: Element, clientX: number, clientY: number) {
  act(() => {
    canvas.dispatchEvent(Object.assign(new Event('contextmenu', { bubbles: true, cancelable: true }), { clientX, clientY }));
  });
}

beforeEach(() => {
  open.mockClear();
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
  global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
});

describe('menu.context beside the HUD', () => {
  it('asks the menu host for a right-click off the chrome, not on a widget', async () => {
    const { container } = render(<Harness />);
    await act(async () => {});
    act(() => { hudRef!.add(panel); });
    (depGet!('menuHost') as { open: unknown }).open = open;
    const canvas = container.querySelector('canvas')!;

    rightClick(canvas, 30, 20);
    expect(open).not.toHaveBeenCalled();

    rightClick(canvas, 150, 150);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
