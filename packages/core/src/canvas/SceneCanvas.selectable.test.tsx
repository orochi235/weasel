/**
 * `selectable={false}` closes every channel the kit writes selection
 * through — the selection dep, its adapter methods, and the adapter the
 * canvas hands its tools — while the consumer's own `SelectionApi` still
 * writes. Click policy is the selection's own `mode`, never the canvas's.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

const A = asNodeId('a');
const B = asNodeId('b');

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.add({ id: A, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  s.add({ id: B, kind: 'leaf', layer: 'main', pose: { x: 20, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  s.history.clear();
  return s;
}

interface Seen {
  adapter?: { setSelection(ids: string[]): void };
  dep?: SelectionApi;
  own?: SelectionApi;
}

function Probe({ seen }: { seen: Seen }) {
  seen.adapter = useOptionalViewInputs()!.adapter as unknown as Seen['adapter'];
  seen.dep = useDepRegistry().get('selection') as SelectionApi | undefined;
  return null;
}

function mount(selectable: boolean, withOwn = false) {
  const scene = makeScene();
  const seen: Seen = {};
  function Host() {
    const own = useSelection({ scene, mode: 'multi' });
    seen.own = own;
    return (
      <SceneCanvas<D, L, P>
        scene={scene} width={200} height={200} selectable={selectable}
        {...(withOwn ? { selection: own } : {})}
      >
        <Probe seen={seen} />
      </SceneCanvas>
    );
  }
  render(<Host />);
  return { scene, seen };
}

describe('selectable={false}', () => {
  it('the adapter handed to tools cannot set the selection', () => {
    const { scene, seen } = mount(false);
    act(() => seen.adapter!.setSelection([A]));
    expect(scene.getSelection()).toEqual([]);
  });

  it('the selection dep cannot set it through its adapter methods either', () => {
    const { scene, seen } = mount(false);
    act(() => seen.dep!.adapterMethods.setSelection([A, B]));
    act(() => seen.dep!.set([A]));
    expect(scene.getSelection()).toEqual([]);
  });

  it('the consumer’s own selection api still writes', () => {
    const { scene, seen } = mount(false, true);
    act(() => seen.own!.set([B]));
    expect(scene.getSelection()).toEqual([B]);
    // …and the canvas reads it.
    expect(seen.dep!.get()).toEqual([B]);
  });

  it('keeps the adapter identity stable across renders', () => {
    const { seen } = mount(false, true);
    const first = seen.adapter;
    act(() => seen.own!.set([A]));
    expect(seen.adapter).toBe(first);
  });
});

describe('selectable (default)', () => {
  it('the adapter and the dep both write', () => {
    const { scene, seen } = mount(true);
    act(() => seen.adapter!.setSelection([A]));
    expect(scene.getSelection()).toEqual([A]);
    act(() => seen.dep!.adapterMethods.setSelection([B]));
    expect(scene.getSelection()).toEqual([B]);
  });
});

describe('click policy is the selection’s mode', () => {
  function shiftClickB(own: 'single' | 'multi' | 'internal-multi') {
    const scene = makeScene();
    scene.setSelection([A]);
    function Host() {
      const selection = useSelection({ scene, mode: own === 'multi' ? 'multi' : 'single' });
      return (
        <SceneCanvas<D, L, P>
          features={['pick']} scene={scene} width={200} height={200}
          {...(own === 'internal-multi'
            ? { selectionOptions: { mode: 'multi' } }
            : { selection })}
        />
      );
    }
    const { container } = render(<Host />);
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 25, clientY: 5, pointerId: 1, button: 0, shiftKey: true });
      fireEvent.pointerUp(canvas, { clientX: 25, clientY: 5, pointerId: 1, button: 0, shiftKey: true });
    });
    return scene.getSelection();
  }

  it('a supplied multi selection extends on shift-click', () => {
    expect(shiftClickB('multi')).toEqual([A, B]);
  });

  it('a supplied single selection replaces on shift-click', () => {
    expect(shiftClickB('single')).toEqual([B]);
  });

  it('the canvas’s own selection follows selectionOptions.mode', () => {
    expect(shiftClickB('internal-multi')).toEqual([A, B]);
  });

  it('the canvas takes no click policy of its own', () => {
    const scene = makeScene();
    // @ts-expect-error — the selection owns click policy
    render(<SceneCanvas<D, L, P> scene={scene} width={200} height={200} selectionMode="multi" />);
  });
});
