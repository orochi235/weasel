/**
 * An always-live `pointerDown` binding beside the select tool. The tool's own
 * press binding sits a tier above it, so it takes every press it matches; it
 * matches a press on a node and leaves one on empty canvas alone.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Action } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { Contribution } from '../tools/overlayBinding';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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

/** Two 50×50 rects, at the origin and at x = 100. Empty canvas is past x = 150. */
function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    for (const x of [0, 100]) {
      s.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x, y: 0, width: 50, height: 50 } });
    }
  });
  return s;
}

function mount(initial: (ids: NodeId[]) => NodeId[] = () => []) {
  const scene = makeScene();
  const ids = [...scene.renderOrder()];
  const pressed = vi.fn();
  const press: Action = {
    id: 'test.press', label: 'Press',
    invoker: { timing: 'immediate', run: () => { pressed(); } },
  };
  const ambient: Contribution[] = [{
    id: 'test.press', eligibility: { always: true }, actions: [press],
    bindings: [{ spec: { kind: 'pointerDown' }, actionId: press.id }],
  }];
  let api: SelectionApi | null = null;
  function Mount(): ReactNode {
    const selection = useSelection({ mode: 'multi', initial: initial(ids) });
    api = selection;
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={200}
        ambient={ambient} selection={selection} />
    );
  }
  const { container } = render(<Mount />);
  const canvas = container.querySelector('canvas')!;
  const fire = (type: string, x: number, y: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    });
  };
  const selected = (): readonly NodeId[] => api!.get();
  return { ids, pressed, fire, selected };
}

describe('an ambient pointerDown binding while the select tool is active', () => {
  it('fires for a press on empty canvas', () => {
    const { pressed, fire } = mount();
    fire('pointerdown', 180, 180);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('stays behind the tool for a press on a node, which selects it', () => {
    const { ids, pressed, fire, selected } = mount();
    fire('pointerdown', 25, 25);
    expect(pressed).not.toHaveBeenCalled();
    expect(selected()).toEqual([ids[0]]);
  });

  it('leaves a click on empty canvas clearing the selection', () => {
    const { ids, fire, selected } = mount((all) => [all[0]]);
    expect(selected()).toEqual([ids[0]]);
    fire('pointerdown', 180, 180);
    fire('pointerup', 180, 180);
    expect(selected()).toEqual([]);
  });

  // The press on a selected node defers its collapse to the click. A drag
  // leaves that deferral unspent, and an empty press no longer resets it.
  it('clears, rather than collapsing to a stale deferred node, after a drag of a multi-selection', () => {
    const { fire, selected } = mount((all) => all);
    fire('pointerdown', 25, 25);
    fire('pointermove', 60, 25);
    fire('pointerup', 60, 25);
    expect(selected()).toHaveLength(2);
    fire('pointerdown', 180, 180);
    fire('pointerup', 180, 180);
    expect(selected()).toEqual([]);
  });
});
