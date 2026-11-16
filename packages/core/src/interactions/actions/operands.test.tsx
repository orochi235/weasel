/**
 * Editing actions act on the `operands` dep: the selection by default, and
 * any other list a host sources in its place, the selection left alone.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useActionsRegistry, useDepSource } from '@weasel-js/routing/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { drawPreset } from 'canvas/SceneCanvas/presets';
import { operandList, type OperandsDep } from './operands';
import { deleteAction } from './defaults/delete';
import { nudgeRightAction } from './defaults/nudge';
import type { ImmediateInvoker } from '@weasel-js/routing';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

type P = { x: number; y: number; width: number; height: number };
const A = asNodeId('a');
const B = asNodeId('b');

function twoBoxes() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  scene.add({ id: B, kind: 'mark', layer: 'main', pose: { x: 50, y: 0, width: 10, height: 10 }, data: {} });
  return scene;
}

function mount(operands?: OperandsDep) {
  const scene = twoBoxes();
  scene.setSelection([A]);
  let actions!: ActionsRegistry;
  function Grab() {
    actions = useActionsRegistry()!;
    useDepSource('operands', (below) => operands ?? below()!);
    return null;
  }
  render(
    <SceneCanvas features={[drawPreset]} scene={scene} layers={{}} width={100} height={100}>
      <Grab />
    </SceneCanvas>,
  );
  const trigger = (id: string) => act(() => { actions.trigger(id); });
  return { scene, trigger };
}

describe('the operands dep', () => {
  it('is the selection when nothing else answers it', () => {
    const { scene, trigger } = mount();
    trigger('delete');
    expect(scene.get(A)).toBeUndefined();
    expect(scene.get(B)).toBeDefined();
  });

  it('is what a canvas edits when a host sources its own, the selection untouched', () => {
    const operands = operandList([B]);
    const { scene, trigger } = mount(operands);
    trigger('nudge.right');
    expect(scene.get(B)!.pose).toMatchObject({ x: 51 });
    expect(scene.get(A)!.pose).toMatchObject({ x: 0 });
    trigger('delete');
    expect(scene.get(B)).toBeUndefined();
    expect(scene.get(A)).toBeDefined();
    expect(scene.getSelection()).toEqual([A]);
    expect(operands.get()).toEqual([]);
  });

  it('reaches an action run with no canvas, as a plain list', () => {
    const scene = twoBoxes();
    const operands = operandList([A, B]);
    (nudgeRightAction.invoker as ImmediateInvoker).run({ scene, operands } as never, { magnitude: 'small' } as never);
    expect([A, B].map((id) => (scene.get(id)!.pose as P).x)).toEqual([1, 51]);
    (deleteAction.invoker as ImmediateInvoker).run({ scene, operands } as never, undefined as never);
    expect(scene.nodes.size).toBe(0);
    expect(operands.get()).toEqual([] as NodeId[]);
  });
});
