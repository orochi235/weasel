import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useLayoutDepSource } from './layout';
import type { LayoutStrategy, ReflowTransition } from '../../layout/types';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';

/** Only identity is under test, so any object stands in for a strategy. */
const strategy = () => ({}) as unknown as LayoutStrategy<unknown>;

const emptyScene = () =>
  createScene<null, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useLayoutDepSource', () => {
  it('resolves a static map by container id', () => {
    const ff = strategy();
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource(emptyScene(), { C: ff });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('C')).toBe(ff);
    expect(reg.get('layout')?.getLayout('missing')).toBeNull();
  });

  it('resolves a resolver function', () => {
    const ff = strategy();
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource(emptyScene(), (id) => (id === 'X' ? ff : null));
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('X')).toBe(ff);
    expect(reg.get('layout')?.getLayout('Y')).toBeNull();
  });

  it('returns null for every container when layouts is undefined', () => {
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource(emptyScene(), undefined);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('C')).toBeNull();
  });

  it('carries the drop-target mode, following the latest render', () => {
    let reg!: DepRegistry;
    const scene = emptyScene();
    function Wire({ mode }: { mode?: 'topmost' | 'region' }) {
      useLayoutDepSource(scene, undefined, mode);
      return null;
    }
    const tree = (mode?: 'topmost' | 'region') => (
      <DepRegistryProvider>
        <Wire mode={mode} />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>
    );
    const { rerender } = render(tree());
    expect(reg.get('layout')?.dropTarget).toBeUndefined();
    rerender(tree('topmost'));
    expect(reg.get('layout')?.dropTarget).toBe('topmost');
    rerender(tree('region'));
    expect(reg.get('layout')?.dropTarget).toBe('region');
  });

  it('reads the layout a container declares before the prop', () => {
    const declared: LayoutStrategy<RectPose> = {
      snap: { pickTarget: () => null },
      childPoses: () => new Map(),
      getDropTargets: () => [],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    };
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [{ id: asNodeId('C'), kind: 'container', layer: 'l', pose: { x: 0, y: 0, width: 9, height: 9 }, data: null, layout: declared }],
    });
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource(scene, { C: strategy(), D: strategy() });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('C')).toBe(declared);
    expect(reg.get('layout')?.getLayout('D')).not.toBeNull();
  });

  it("settles each child the scene reflows from where it was, through the transition", () => {
    const stackOf: LayoutStrategy<RectPose> = {
      snap: { pickTarget: () => null },
      childPoses: (c, children) => new Map(children.map((ch, i) => [ch.id, { ...c.bounds, y: c.bounds.y + i * 5, height: 5 }])),
      getDropTargets: () => [],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    };
    const C = asNodeId('C');
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [{ id: C, kind: 'container', layer: 'l', pose: { x: 0, y: 0, width: 9, height: 90 }, data: null, layout: stackOf }],
    });
    const reflow: ReflowTransition<unknown> = {
      glide: vi.fn(), settle: vi.fn(), stop: vi.fn(), poseOf: () => undefined,
    };
    function Wire() {
      useLayoutDepSource(scene, undefined, undefined, reflow);
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const from = { x: 50, y: 50, width: 1, height: 1 };
    scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'l', pose: from, data: null, parent: C });
    expect(reflow.settle).toHaveBeenCalledWith('a', { from });
  });
});
