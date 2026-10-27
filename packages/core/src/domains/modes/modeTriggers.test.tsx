/**
 * A mode's declared double-click trigger reaches the canvas's dispatcher as a binding on the
 * routing kinds the mode names, installed by the `modeTriggers` contribution.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createModeRegistry, DEFAULT_MODES, type ModeDefinition } from '@weasel-js/modes';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { createEnteredGroup } from 'canvas/deps/enteredGroup';
import { modeTriggers, type ModeTriggerHandlers } from './modeTriggers';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const NOTE: ModeDefinition = {
  id: 'note', kind: 'soft', allows: [], scoping: false,
  entry: { trigger: 'double-click-target', targets: ['text', 'image'] },
};
const UNTARGETED: ModeDefinition = { id: 'loose', kind: 'soft', allows: [], scoping: false, entry: { trigger: 'double-click-target' } };

describe('modeTriggers', () => {
  it('binds a double-click on each kind a mode targets, and nothing for a mode with no targets', () => {
    const registry = createModeRegistry({ modes: [DEFAULT_MODES[0]!, NOTE, UNTARGETED], initial: 'normal' });
    const entry = modeTriggers(registry, { enter: () => {} });
    expect(entry.actions!.map((a) => a.id)).toEqual(['mode.note.trigger']);
    expect(entry.actions![0]!.defaultBinding).toEqual([
      { spec: { kind: 'doubleClick', target: 'kind:text' }, opts: { id: 'mode.note.trigger.doubleClick.text' } },
      { spec: { kind: 'doubleClick', target: 'kind:image' }, opts: { id: 'mode.note.trigger.doubleClick.image' } },
    ]);
  });

  it('binds nothing without an `enter` to run', () => {
    const registry = createModeRegistry({ modes: [DEFAULT_MODES[0]!, NOTE], initial: 'normal' });
    expect(modeTriggers(registry, {}).actions).toEqual([]);
  });
});

type D = { path?: PolygonPath; text?: string };
type P = { x: number; y: number; width: number; height: number };
const square = (x: number): P => ({ x, y: 0, width: 30, height: 30 });

const triangle = () => pathFromD('M 0 0 L 30 0 L 30 30 Z') as PolygonPath;

function setup(handlers: ModeTriggerHandlers, enteredId?: string) {
  const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('p'), kind: 'mark', layer: 'main', pose: square(0), data: { path: triangle() } });
  scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', pose: square(40), data: { text: 'hi' } });
  // outer > inner > member, all drawn over x 120..150.
  scene.add({ id: asNodeId('outer'), kind: 'group', layer: 'main', pose: square(120), data: {} } as never);
  scene.add({ id: asNodeId('inner'), kind: 'group', layer: 'main', parent: asNodeId('outer'),
    pose: square(0), data: {} } as never);
  scene.add({ id: asNodeId('member'), kind: 'mark', layer: 'main', parent: asNodeId('inner'),
    pose: square(0), data: { path: triangle() } } as never);
  const entered = createEnteredGroup(scene);
  if (enteredId) entered.enter(asNodeId(enteredId));
  const { container } = render(
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={40}
      ambient={[modeTriggers(registry, handlers)]} modes={registry}
      enteredGroup={entered} />,
  );
  const canvas = container.querySelector('canvas')!;
  const doubleClick = (x: number) => act(() => {
    for (const type of ['pointerdown', 'pointerup', 'pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 15, pointerId: 1, button: 0, buttons: 1 }));
    }
  });
  return { doubleClick, entered };
}

describe('modeTriggers on a canvas', () => {
  it('enters the mode targeting the kind under a double-click, on the node there', () => {
    const enter = vi.fn();
    setup({ enter }).doubleClick(15);
    expect(enter).toHaveBeenCalledExactlyOnceWith('path-edit', 'p');
  });

  it('enters nothing on a kind no mode targets, or on empty canvas', () => {
    const enter = vi.fn();
    const t = setup({ enter });
    t.doubleClick(55);
    t.doubleClick(100);
    expect(enter).not.toHaveBeenCalled();
  });

  it('asks `canEnter` with the mode and the node, and enters nothing where it says no', () => {
    const enter = vi.fn();
    const canEnter = vi.fn(() => false);
    setup({ enter, canEnter }).doubleClick(15);
    expect(canEnter).toHaveBeenCalledWith('path-edit', 'p');
    expect(enter).not.toHaveBeenCalled();
  });

  it('leaves a double-click on a grouped member to the select tool, which enters the group', () => {
    const enter = vi.fn();
    setup({ enter }).doubleClick(135);
    expect(enter).not.toHaveBeenCalled();
  });

  it('leaves a double-click on a nested group inside the entered one to the select tool, which drills in', () => {
    const enter = vi.fn();
    const t = setup({ enter }, 'outer');
    t.doubleClick(135);
    expect(enter).not.toHaveBeenCalled();
    expect(t.entered.get()).toBe('inner');
  });

  it('enters path-edit on a member path with no further group above it inside the entered one', () => {
    const enter = vi.fn();
    setup({ enter }, 'inner').doubleClick(135);
    expect(enter).toHaveBeenCalledExactlyOnceWith('path-edit', 'member');
  });
});
