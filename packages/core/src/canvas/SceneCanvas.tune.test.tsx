import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { ActionTunings } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

function setup(tune: ActionTunings) {
  const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.batch('seed', () => {
    scene.add({ id: asNodeId('a'), kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
    scene.add({ id: asNodeId('b'), kind: 'mark', data: {}, layer: 'main', pose: { x: 40, y: 0, width: 10, height: 10 } });
  });
  render(
    <SceneCanvas
      features={['arrange']} scene={scene} layers={{}} width={64} height={64}
      selectionOptions={{ mode: 'multi', initial: [asNodeId('a'), asNodeId('b')] }}
      tune={tune}
    />,
  );
  const xs = () => ['a', 'b'].map((id) => (scene.get(asNodeId(id))!.pose as P).x);
  return { xs };
}

const press = (key: string, shiftKey = false) => act(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
});

describe('<SceneCanvas tune>', () => {
  it('binds a key to an action, with the params that binding passes', () => {
    const { xs } = setup({
      flip: { bindings: [{ spec: { kind: 'key', key: 'k' }, opts: { params: { axis: 'x', pivot: 'union' } } }] },
    });
    press('k');
    expect(xs()).toEqual([40, 0]);
  });

  it("fills params in under the action's own bindings, without restating their gestures", () => {
    const { xs } = setup({ flip: { params: { pivot: 'union' } } });
    press('H', true);
    expect(xs()).toEqual([40, 0]);
  });

  it("types a kit action's params, and takes any id's", () => {
    // @ts-expect-error flip's axis is 'x' or 'y'
    const wrong: ActionTunings = { flip: { params: { axis: 'z' } } };
    const other: ActionTunings = { simplifyBrush: { params: () => ({ radiusPx: 12 }) } };
    expect([wrong, other]).toHaveLength(2);
  });

  it('reads a params thunk at each invocation', () => {
    let pivot: 'each' | 'union' = 'each';
    const { xs } = setup({ flip: { params: () => ({ pivot }) } });
    press('H', true);
    expect(xs()).toEqual([0, 40]);
    pivot = 'union';
    press('H', true);
    expect(xs()).toEqual([40, 0]);
  });
});
