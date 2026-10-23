/**
 * Entering a group with real pointer and key events on a draw-like scene in a real browser:
 * a double-click enters the group, a press then selects the member, a double-click on a member
 * that is not a group still reaches the path-edit trigger, and Escape leaves.
 */
import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { modeTriggers } from 'features/modes/modeTriggers';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

type D = { path?: PolygonPath };
type P = { x: number; y: number; width: number; height: number };
const box = (x: number, w = 60): P => ({ x, y: 20, width: w, height: 60 });
const triangle = () => pathFromD('M 0 0 L 60 0 L 60 60 Z') as PolygonPath;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount() {
  const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
  const enter = vi.fn();
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', pose: box(20, 200), data: {} } as never);
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: box(20), data: { path: triangle() } } as never);
  scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: box(160), data: { path: triangle() } } as never);
  let sel!: SelectionApi;
  function Canvas() {
    sel = useSelection({ mode: 'multi' });
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={300} height={100} selection={sel}
        ambient={[modeTriggers(registry, { enter })]} modes={registry} />
    );
  }
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
    root.render(<Canvas />);
  });
  const canvas = host.querySelector('canvas')!;
  giveKeys(canvas);
  return { canvas, enter, selection: () => [...sel.current] };
}

const fire = (el: Element, type: string, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + x, clientY: r.top + y,
  }));
};

async function press(canvas: Element, x: number, y = 50) {
  await act(async () => {
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x, y);
  });
}

const doubleClick = async (canvas: Element, x: number) => {
  await press(canvas, x);
  await press(canvas, x);
};

const escape = () => act(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});

it('a double-click enters the group and a press then selects the member', async () => {
  const t = await mount();
  await press(t.canvas, 40);
  expect(t.selection()).toEqual(['g']);
  await doubleClick(t.canvas, 40);
  await press(t.canvas, 40);
  expect(t.selection()).toEqual(['a']);
  expect(t.enter).not.toHaveBeenCalled();
});

it('a double-click on a member inside the entered group reaches path-edit', async () => {
  const t = await mount();
  await doubleClick(t.canvas, 40);
  await doubleClick(t.canvas, 40);
  expect(t.enter).toHaveBeenCalledExactlyOnceWith('path-edit', 'a');
});

it('Escape and a press outside the group both leave it', async () => {
  const t = await mount();
  await doubleClick(t.canvas, 40);
  await escape();
  await press(t.canvas, 40);
  expect(t.selection()).toEqual(['g']);
  await doubleClick(t.canvas, 40);
  await press(t.canvas, 290, 95);
  await press(t.canvas, 40);
  expect(t.selection()).toEqual(['g']);
});
