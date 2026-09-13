/**
 * An interactive loupe is a view on the canvas: a press inside the lens acts on
 * what the lens shows, in the lens's world units. A plain one keeps its
 * interior to itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { NodeId, SceneCanvasApi } from '@weasel-js/core';
import { useHud, useHudContribution } from '../react';
import type { Hud } from '../hud';
import { createLoupe, type LoupeHandle } from './createLoupe';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';

type Pose = { x: number; y: number; width: number; height: number };
type Data = { kind: 'rect' };

/** jsdom's PointerEvent drops clientX from its init dict. */
function pointer(type: string, x: number, y: number): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  return ev;
}

/**
 * Loupe bounds (24, 24, 220, 200) put its content rect at (30, 48, 208, 170).
 * Aimed at world (300, 300) on an identity canvas at 4×, the lens camera is
 * `{ x: 274, y: 278.75, scale: 4 }`. The node at world (280, 290, 10×10) then
 * shows at canvas (54..94, 93..133), and a press at canvas (64, 103) lands on
 * world (282.5, 292.5) — on `n` through the lens. On the canvas's own camera
 * the same press lands on `under`, which sits beneath the window.
 */
const BOUNDS = { x: 24, y: 24, w: 220, h: 200 };
const AIM = { x: 300, y: 300 };
const PRESS = { x: 64, y: 103 };

interface Mounted {
  canvas: HTMLCanvasElement;
  api: SceneCanvasApi;
  hud: Hud;
  selection: () => readonly NodeId[];
  pose: () => Pose;
}

async function mount(): Promise<Mounted> {
  let hud!: Hud;
  let scene!: ReturnType<typeof useScene<Data, string, Pose>>;
  const ref = React.createRef<SceneCanvasApi>();
  function Harness() {
    hud = useHud(ref);
    const contribution = useHudContribution();
    scene = useScene<Data, string, Pose>({
      systemLayers: [{ id: 'default' }],
      initial: [
        {
          id: 'n' as never, kind: 'leaf', layer: 'default',
          pose: { x: 280, y: 290, width: 10, height: 10 }, data: { kind: 'rect' },
        },
        {
          id: 'under' as never, kind: 'leaf', layer: 'default',
          pose: { x: 54, y: 93, width: 20, height: 20 }, data: { kind: 'rect' },
        },
      ],
    });
    return (
      <SceneCanvas ref={ref} scene={scene} layers={{}} width={400} height={400} ambient={[contribution]} />
    );
  }
  const r = render(<Harness />);
  await act(async () => {});
  return {
    canvas: r.container.querySelector('canvas')!,
    api: ref.current!,
    hud,
    selection: () => scene.getSelection(),
    pose: () => scene.nodes.get('n' as NodeId)!.pose,
  };
}

type Kind = 'interactive' | 'view' | 'picture';

async function openLoupe(m: Mounted, kind: Kind): Promise<LoupeHandle> {
  let loupe!: LoupeHandle;
  await act(async () => {
    loupe = createLoupe({
      hud: m.hud,
      canvas: m.canvas,
      requestRedraw: () => m.api.requestRedraw(),
      bounds: BOUNDS,
      factor: 4,
      ...(kind === 'picture' ? { source: [] } : { views: m.api, interactive: kind === 'interactive' }),
    });
    loupe.aimAt(AIM);
  });
  return loupe;
}

async function press(el: Element, steps: Array<[string, number, number]>) {
  await act(async () => {
    for (const [type, x, y] of steps) el.dispatchEvent(pointer(type, x, y));
  });
}

beforeEach(() => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
  global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('an interactive loupe', () => {
  it('selects the node the lens shows under the pointer', async () => {
    const m = await mount();
    await openLoupe(m, 'interactive');
    await press(m.canvas, [['pointerdown', PRESS.x, PRESS.y], ['pointerup', PRESS.x, PRESS.y]]);
    expect(m.selection()).toEqual(['n']);
  });

  it('drags the node by the pointer travel over the lens factor', async () => {
    const m = await mount();
    await openLoupe(m, 'interactive');
    await press(m.canvas, [
      ['pointerdown', PRESS.x, PRESS.y],
      ['pointermove', PRESS.x + 20, PRESS.y],
      ['pointermove', PRESS.x + 40, PRESS.y],
      ['pointerup', PRESS.x + 40, PRESS.y],
    ]);
    expect(m.pose()).toMatchObject({ x: 290, y: 290 });
    // The window stayed put: the interior is not its move handle.
    expect(m.hud.widgets()[0]!.bounds).toMatchObject({ x: BOUNDS.x, y: BOUNDS.y });
  });

  it('holds its aim for a drag that leaves the lens', async () => {
    const m = await mount();
    const loupe = await openLoupe(m, 'interactive');
    await press(m.canvas, [
      ['pointerdown', PRESS.x, PRESS.y],
      ['pointermove', 360, PRESS.y],
    ]);
    expect(loupe.aim).toEqual(AIM);
    await press(m.canvas, [['pointerup', 360, PRESS.y]]);
  });

  it('leaves a HUD window stacked over the lens reachable', async () => {
    const m = await mount();
    await openLoupe(m, 'interactive');
    let top!: ReturnType<Hud['window']>;
    await act(async () => { top = m.hud.window({ id: 'top', x: 40, y: 90, w: 60, h: 60, title: 'Top' }); });
    // (64, 103) is on `top`'s titlebar: dragging it moves the window.
    await press(m.canvas, [
      ['pointerdown', PRESS.x, PRESS.y],
      ['pointermove', PRESS.x + 20, PRESS.y],
      ['pointermove', PRESS.x + 40, PRESS.y],
      ['pointerup', PRESS.x + 40, PRESS.y],
    ]);
    expect(top.bounds.x).toBe(80);
    expect(m.pose()).toMatchObject({ x: 280, y: 290 });
    expect(m.selection()).toEqual([]);
  });

  it('stops routing once disposed', async () => {
    const m = await mount();
    const loupe = await openLoupe(m, 'interactive');
    await act(async () => { loupe.dispose(); });
    await press(m.canvas, [['pointerdown', PRESS.x, PRESS.y], ['pointerup', PRESS.x, PRESS.y]]);
    expect(m.selection()).toEqual(['under']);
  });
});

describe('a loupe that paints through a view but takes no input', () => {
  it('keeps a press inside the lens off the scene and inside the window', async () => {
    const m = await mount();
    await openLoupe(m, 'view');
    await press(m.canvas, [['pointerdown', PRESS.x, PRESS.y], ['pointerup', PRESS.x, PRESS.y]]);
    expect(m.selection()).toEqual([]);
  });

  it('paints the canvas stack through the lens camera', async () => {
    const m = await mount();
    const loupe = await openLoupe(m, 'view');
    const cmds = loupe.window.content!({
      data: {}, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, dims: { width: 400, height: 400 },
      rect: loupe.window.contentRect, defaultFont: 'D', tokens: {} as never,
    });
    // The backdrop, then the view's clipped group.
    expect(cmds.map((c) => c.kind)).toEqual(['path', 'group']);
  });
});

describe('a plain loupe', () => {
  it('keeps a press inside the lens off the scene', async () => {
    const m = await mount();
    await openLoupe(m, 'picture');
    // A leak to the canvas would select `under`.
    await press(m.canvas, [['pointerdown', PRESS.x, PRESS.y], ['pointerup', PRESS.x, PRESS.y]]);
    expect(m.selection()).toEqual([]);
  });

  it('leaves a titled window\u2019s interior inert, as before', async () => {
    const m = await mount();
    const loupe = await openLoupe(m, 'picture');
    await press(m.canvas, [
      ['pointerdown', PRESS.x, PRESS.y],
      ['pointermove', PRESS.x + 20, PRESS.y],
      ['pointermove', PRESS.x + 40, PRESS.y],
      ['pointerup', PRESS.x + 40, PRESS.y],
    ]);
    expect(loupe.window.bounds.x).toBe(BOUNDS.x);
    expect(m.pose()).toMatchObject({ x: 280, y: 290 });
    expect(m.selection()).toEqual([]);
  });
});
