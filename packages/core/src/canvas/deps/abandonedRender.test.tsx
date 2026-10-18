/**
 * Every dep source reads its inputs at dispatch time. A render React throws
 * away must leave those reads on the last committed inputs — `a` here — never
 * on the abandoned render's `b`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { Dispatcher } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { ViewApi } from 'interactions/actions/depSchema';
import { useAreaSelectDepSource } from './areaSelect';
import { useLassoSelectDepSource } from './lassoSelect';
import { useDispatcherDepSource } from './dispatcher';
import { useEditAnchorsDepSource, type EditAnchorsStateRef } from './editAnchors';
import { useGeometryProjection } from './geometryProjection';
import { useIngestionDepSource } from './ingestion';
import { useInsertDepSource } from './insert';
import { useLayoutDepSource } from './layout';
import { useNodeAtPointDepSource } from './nodeAtPoint';
import { usePoseDescriptorDepSource } from './poseDescriptor';
import { useResizePolicy } from './resizePolicy';
import { useSliceDep } from './slice';
import { useSnapDepSource } from './snap';
import { useTextEditDepSource } from './textEdit';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import type { SnapSource } from 'features/snap/types';
import { createScene } from 'core/scene/scene';
import { drawnBoxes } from 'interactions/actions/drawnBoxes';
import { useViewDepSource } from './view';

afterEach(() => { cleanup(); });

/** Commits `use(a)`, abandons a render of `use(b)`, and hands back the registry. */
function registryAfterAbandon<P>(a: P, b: P, use: (p: P) => void): DepRegistry {
  let reg!: DepRegistry;
  function Wire({ p }: { p: P }) {
    use(p);
    return null;
  }
  function Capture() {
    reg = useDepRegistry();
    return null;
  }
  renderThenAbandon(a, b, (p) => (
    <DepRegistryProvider>
      <Wire p={p} />
      <Capture />
    </DepRegistryProvider>
  ));
  return reg;
}

const dep = (reg: DepRegistry, name: string): any => (reg.get as (n: string) => unknown)(name);

const selectionOf = (ids: string[]) => ({ current: ids, set: vi.fn() }) as unknown as SelectionApi;
const sceneWith = (get: (id: string) => unknown = () => undefined) =>
  ({
    layers: [{ id: 'default' }], get, renderOrderNodes: () => [], layoutOf: () => null, onReflow: () => () => {},
    mintId: () => 'minted',
    composition: IDENTITY_POSE_COMPOSITION,
  }) as unknown as Scene<unknown, string, unknown>;

describe('dep sources after an abandoned render', () => {
  it('areaSelect reads the committed selection', () => {
    const scene = sceneWith();
    const reg = registryAfterAbandon(selectionOf(['a']), selectionOf(['b']), (s) => {
      useAreaSelectDepSource(scene, s);
    });
    expect(dep(reg, 'areaSelect').getSelection()).toEqual(['a']);
  });

  it('lassoSelect reads the committed selection', () => {
    const scene = sceneWith();
    const reg = registryAfterAbandon(selectionOf(['a']), selectionOf(['b']), (s) => {
      useLassoSelectDepSource(scene, s);
    });
    expect(dep(reg, 'lassoSelect').getSelection()).toEqual(['a']);
  });

  it('dispatcher cancels through the committed dispatcher', () => {
    const a = { cancelAll: vi.fn() } as unknown as Dispatcher;
    const b = { cancelAll: vi.fn() } as unknown as Dispatcher;
    const reg = registryAfterAbandon(a, b, (d) => { useDispatcherDepSource(d); });
    dep(reg, 'dispatcher').cancelAll('test');
    expect(a.cancelAll).toHaveBeenCalledWith('test');
    expect(b.cancelAll).not.toHaveBeenCalled();
  });

  it('editAnchors writes through the committed external state', () => {
    const ext = (): EditAnchorsStateRef => ({
      getEditingId: () => '',
      setEditingId: vi.fn(),
      getSelectedAnchors: () => new Set(),
      setSelectedAnchors: vi.fn(),
      getMarquee: () => null,
      setMarquee: vi.fn(),
      getSelectedMark: () => null,
      setSelectedMark: vi.fn(),
      getExtensions: () => [],
      getHandleLocks: () => null,
      setHandleLocks: vi.fn(),
      getTool: () => null,
      setTool: vi.fn(),
    });
    const a = ext();
    const b = ext();
    const scene = sceneWith();
    const selection = selectionOf([]);
    const adapter = { applyOps: vi.fn() };
    const reg = registryAfterAbandon(a, b, (e) => {
      useEditAnchorsDepSource(scene, selection, adapter, e);
    });
    dep(reg, 'editAnchors').setEditingId('n1');
    expect(a.setEditingId).toHaveBeenCalledWith('n1');
    expect(b.setEditingId).not.toHaveBeenCalled();
  });

  it('geometryProjection hands out the committed projection', () => {
    const a = { transform: () => 'a' };
    const b = { transform: () => 'b' };
    const reg = registryAfterAbandon(a, b, (p) => { useGeometryProjection(p); });
    expect(dep(reg, 'geometryProjection')).toBe(a);
  });

  it('ingestion hands out the committed svg options', () => {
    const canvasRef = { current: null };
    const getView = (): View => ({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    const a = {};
    const b = {};
    const reg = registryAfterAbandon(a, b, (svg) => {
      useIngestionDepSource(canvasRef, getView, undefined, svg);
    });
    expect(dep(reg, 'ingestion').svg).toBe(a);
  });

  it('insert commits through the committed factories and adapter', () => {
    const make = () => ({
      factory: vi.fn(() => ({ data: {} })),
      adapter: { applyOps: vi.fn() },
    });
    const a = make();
    const b = make();
    const scene = sceneWith();
    const reg = registryAfterAbandon(a, b, (x) => {
      useInsertDepSource(scene, x.adapter, { rect: x.factory });
    });
    dep(reg, 'insert').commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    expect(a.factory).toHaveBeenCalled();
    expect(a.adapter.applyOps).toHaveBeenCalled();
    expect(b.factory).not.toHaveBeenCalled();
    expect(b.adapter.applyOps).not.toHaveBeenCalled();
  });

  it('layout reads the committed drop target', () => {
    const scene = sceneWith();
    const reg = registryAfterAbandon(
      { drop: 'innermost' as const },
      { drop: 'topmost' as const },
      (p) => { useLayoutDepSource(scene as never, p.drop); },
    );
    expect(dep(reg, 'layout').dropTarget).toBe('innermost');
  });

  it('nodeAtPoint picks through the committed pickEvery', () => {
    const reg = registryAfterAbandon(() => ['a'], () => ['b'], (pick) => {
      useNodeAtPointDepSource(pick);
    });
    expect(dep(reg, 'nodeAtPoint')({ x: 0, y: 0 })).toBe('a');
  });

  it('poseDescriptor hands out the committed descriptor', () => {
    const a = {};
    const b = {};
    const reg = registryAfterAbandon(a, b, (d) => { usePoseDescriptorDepSource(d as never); });
    expect(dep(reg, 'poseDescriptor')).toBe(a);
  });

  it('resizePolicy reads the committed options', () => {
    const reg = registryAfterAbandon({ label: 'a' }, { label: 'b' }, (o) => { useResizePolicy(o); });
    expect(dep(reg, 'resizePolicy').label).toBe('a');
  });

  it('slice hands out the committed dep', () => {
    const a = {};
    const b = {};
    const reg = registryAfterAbandon(a, b, (d) => { useSliceDep(d as never); });
    expect(dep(reg, 'slice')).toBe(a);
  });

  it('snap runs its sessions over the committed sources', () => {
    const scene = createScene({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
    const at = (x: number): SnapSource => ({
      id: 'at', roles: ['pointer'],
      *collect(q) { for (const p of q.probes) yield { probe: p.id, locus: { at: { x, y: x }, dirs: [] } }; },
    });
    const reg = registryAfterAbandon(at(1), at(2), (source) => {
      useSnapDepSource({ current: null }, { scene, boxes: () => drawnBoxes({ scene }), sources: [source] }, createSnapOutcomeStore());
    });
    const session = dep(reg, 'snap').begin({ gesture: 'point', press: { x: 0, y: 0 } });
    expect(session.at({ x: 0, y: 0 }, { suspend: false, constrain: false }).point).toEqual({ x: 1, y: 1 });
  });

  it('textEdit reads the committed scene', () => {
    const a = sceneWith(() => ({ data: { text: 'hi' } }));
    const b = sceneWith(() => ({ data: {} }));
    const reg = registryAfterAbandon(a, b, (s) => { useTextEditDepSource(s); });
    expect(dep(reg, 'textEdit').isTextNode('n')).toBe(true);
  });
});

describe('useViewDepSource after an abandoned render', () => {
  it('writes through the committed onViewChange', () => {
    const viewRef = { current: { x: 0, y: 0, scale: { x: 1, y: 1 } } as View };
    const a = vi.fn();
    const b = vi.fn();
    let api!: ViewApi;
    function Wire({ onChange }: { onChange: (v: View) => void }) {
      api = useViewDepSource(viewRef, onChange);
      return null;
    }
    renderThenAbandon(a, b, (onChange) => <Wire onChange={onChange} />);
    const next = { x: 5, y: 5, scale: { x: 1, y: 1 } };
    api.set(next);
    expect(a).toHaveBeenCalledWith(next);
    expect(b).not.toHaveBeenCalled();
  });

  it('keeps one API while the wired members stay the same', () => {
    const viewRef = { current: { x: 0, y: 0, scale: { x: 1, y: 1 } } as View };
    const { result, rerender } = renderHook(
      ({ onChange }) => useViewDepSource(viewRef, onChange),
      { initialProps: { onChange: vi.fn() } },
    );
    const first = result.current;
    rerender({ onChange: vi.fn() });
    expect(result.current).toBe(first);
  });
});
