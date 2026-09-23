/**
 * `selectionMode="none"` closes every channel the kit writes selection
 * through — the selection dep, its adapter methods, and the adapter the
 * canvas hands its tools — while the consumer's own `SelectionApi` still
 * writes.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { CanvasSelectionMode } from './Canvas';

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

function mount(mode: CanvasSelectionMode, withOwn = false) {
  const scene = makeScene();
  const seen: Seen = {};
  function Host() {
    const own = useSelection({ scene, mode: 'multi' });
    seen.own = own;
    return (
      <SceneCanvas<D, L, P>
        scene={scene} width={200} height={200} selectionMode={mode}
        {...(withOwn ? { selection: own } : {})}
      >
        <Probe seen={seen} />
      </SceneCanvas>
    );
  }
  render(<Host />);
  return { scene, seen };
}

describe('selectionMode="none"', () => {
  it('the adapter handed to tools cannot set the selection', () => {
    const { scene, seen } = mount('none');
    act(() => seen.adapter!.setSelection([A]));
    expect(scene.getSelection()).toEqual([]);
  });

  it('the selection dep cannot set it through its adapter methods either', () => {
    const { scene, seen } = mount('none');
    act(() => seen.dep!.adapterMethods.setSelection([A, B]));
    act(() => seen.dep!.set([A]));
    expect(scene.getSelection()).toEqual([]);
  });

  it('the consumer’s own selection api still writes', () => {
    const { scene, seen } = mount('none', true);
    act(() => seen.own!.set([B]));
    expect(scene.getSelection()).toEqual([B]);
    // …and the canvas reads it.
    expect(seen.dep!.get()).toEqual([B]);
  });

  it('keeps the adapter identity stable across renders', () => {
    const { seen } = mount('none', true);
    const first = seen.adapter;
    act(() => seen.own!.set([A]));
    expect(seen.adapter).toBe(first);
  });
});

describe.each(['single', 'multi'] as const)('selectionMode="%s"', (mode) => {
  it('the adapter and the dep both write', () => {
    const { scene, seen } = mount(mode);
    act(() => seen.adapter!.setSelection([A]));
    expect(scene.getSelection()).toEqual([A]);
    act(() => seen.dep!.adapterMethods.setSelection([B]));
    expect(scene.getSelection()).toEqual([B]);
  });
});
