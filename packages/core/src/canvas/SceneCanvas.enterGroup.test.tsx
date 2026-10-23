/**
 * Entering a group on a real canvas: a double-click enters it, a double-click on a non-group
 * member inside it still reaches the mode triggers, and Escape or a press outside leaves it.
 * Nodes outside the entered group take no hits.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { modeTriggers } from 'features/modes/modeTriggers';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { BindingOverrides } from '@weasel-js/routing';
import { createEnteredGroup, type EnteredGroupDep } from './deps/enteredGroup';
import { SceneCanvas } from './SceneCanvas';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

type D = { path?: PolygonPath };
type P = { x: number; y: number; width: number; height: number };
const box = (x: number, w = 30): P => ({ x, y: 0, width: w, height: 30 });
const triangle = () => pathFromD('M 0 0 L 30 0 L 30 30 Z') as PolygonPath;

function setup(opts: { entered?: (scene: never) => EnteredGroupDep; overrides?: BindingOverrides } = {}) {
  const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
  const enter = vi.fn();
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', pose: box(0, 100), data: {} } as never);
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: box(0), data: { path: triangle() } } as never);
  scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: box(40), data: { path: triangle() } } as never);
  scene.add({ id: asNodeId('f'), kind: 'mark', layer: 'main', pose: box(150), data: { path: triangle() } } as never);
  const entered = opts.entered?.(scene as never);
  let sel!: SelectionApi;
  function Canvas() {
    sel = useSelection({ mode: 'multi' });
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={300} height={40} selection={sel}
        ambient={[modeTriggers(registry, { enter })]} modes={registry}
        {...(entered ? { enteredGroup: entered } : {})}
        {...(opts.overrides ? { bindingOverrides: opts.overrides } : {})} />
    );
  }
  const { container } = render(<Canvas />);
  const canvas = container.querySelector('canvas')!;
  const press = (x: number) => act(() => {
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 15, pointerId: 1, button: 0, buttons: 1 }));
    }
  });
  const doubleClick = (x: number) => { press(x); press(x); };
  const escape = () => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  return { enter, press, doubleClick, escape, entered, selection: () => [...sel.current] };
}

describe('entering a group on a canvas', () => {
  it('a double-click on a member enters the group, and a press then selects the member', () => {
    const t = setup();
    t.doubleClick(15);
    expect(t.enter).not.toHaveBeenCalled();
    t.press(15);
    expect(t.selection()).toEqual(['a']);
  });

  it('a double-click on a non-group member inside the entered group reaches the mode triggers', () => {
    const t = setup();
    t.doubleClick(15);
    t.doubleClick(15);
    expect(t.enter).toHaveBeenCalledExactlyOnceWith('path-edit', 'a');
  });

  it('Escape leaves the entered group, so a press selects the group again', () => {
    const t = setup();
    t.doubleClick(15);
    t.escape();
    t.press(15);
    expect(t.selection()).toEqual(['g']);
  });

  it('a press on empty canvas outside the group box leaves it', () => {
    const t = setup();
    t.doubleClick(15);
    t.press(200);
    t.press(15);
    expect(t.selection()).toEqual(['g']);
  });

  it('a press on a node outside the entered group takes no hit: it leaves the group and selects nothing', () => {
    const t = setup();
    t.press(15);
    t.doubleClick(15);
    t.press(165);
    expect(t.selection()).toEqual([]);
    t.press(15);
    expect(t.selection()).toEqual(['g']);
  });

  it('enters the consumer\'s own entered group when one is passed', () => {
    const t = setup({ entered: (scene) => createEnteredGroup(scene) });
    t.doubleClick(15);
    expect(t.entered!.get()).toBe('g');
  });

  it('keeps the group on an outside press once group.leave.press is unbound', () => {
    const t = setup({ entered: (scene) => createEnteredGroup(scene), overrides: { 'group.leave.press': null } });
    t.doubleClick(15);
    t.press(200);
    t.press(165);
    expect(t.entered!.get()).toBe('g');
    t.escape();
    expect(t.entered!.get()).toBeNull();
  });
});
