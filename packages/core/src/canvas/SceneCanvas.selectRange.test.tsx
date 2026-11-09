/**
 * `<SceneCanvas>` sources `selectRange`: the range its select tool applies, for an action that
 * applies a click outside the tool (a diagram's edge label) to range the same way.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { SelectRangeDep } from 'tools/builtin/select/selectRange';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext = vi.fn(() => null);
});

function mount() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const add = (id: string, x: number, y: number, kind: 'mark' | 'group' = 'mark', parent?: string, size = 10) =>
    scene.add({ id: asNodeId(id), kind, layer: 'main', data: {}, pose: { x, y, width: size, height: size },
      ...(parent ? { parent: asNodeId(parent) } : {}) });
  // `wide` reaches into the a–d box but its center lies outside it; `g` comes whole.
  add('a', 0, 0);
  add('g', 20, 20, 'group', undefined, 20);
  add('g1', 20, 20, 'mark', 'g');
  add('d', 60, 60);
  scene.add({ id: asNodeId('wide'), kind: 'mark', layer: 'main', data: {}, pose: { x: 65, y: 0, width: 100, height: 10 } });
  add('e', 100, 100);
  const seen: { dep?: SelectRangeDep; selection?: SelectionApi } = {};
  function Probe() {
    const registry = useDepRegistry();
    Object.defineProperty(seen, 'dep', { get: () => registry.get('selectRange'), configurable: true });
    return null;
  }
  function Host() {
    seen.selection = useSelection({ scene, mode: 'multi', extend: 'meta', range: 'shift' });
    return (
      <SceneCanvas<object, 'main', P> scene={scene} width={200} height={200} selection={seen.selection} features={['pick']}>
        <Probe />
      </SceneCanvas>
    );
  }
  render(<Host />);
  return seen;
}

describe('the selectRange dep', () => {
  it('ranges over the box the two ends span, by center, taking a group whole', () => {
    const seen = mount();
    const between = seen.dep!.at(null);
    expect([...between(asNodeId('a'), asNodeId('d'))].sort()).toEqual(['a', 'd', 'g']);
  });

  it('is what a range click outside the select tool applies', () => {
    const seen = mount();
    const shift = { shift: true, meta: false, ctrl: false };
    act(() => seen.selection!.applyClick(asNodeId('a'), { ...shift, shift: false }));
    act(() => seen.selection!.applyClick(asNodeId('d'), shift, seen.dep!.at(null)));
    expect([...seen.selection!.get()].sort()).toEqual<NodeId[]>(['a', 'd', 'g'] as NodeId[]);
  });
});
