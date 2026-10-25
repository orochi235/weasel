import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { reportRouteConflicts, type Action, type ActionDeps, type InvocationCtx, type OngoingHandle } from '@weasel-js/routing';
import type { BooleansAdapter, NodeId, RenderLayer } from '@weasel-js/core';
import { rootsTreeForTests as rootsTree } from '@weasel-js/core/test-seams';
import { useShapeBuilderTool } from './useShapeBuilderTool';

const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const noMods = { shift: false, alt: false, meta: false, ctrl: false };

/** a (back) at 0..10, b in front at 5..15. */
function setup(ids: string[] = ['a', 'b'], opts: Parameters<typeof useShapeBuilderTool>[0] = {}) {
  const { result } = renderHook(() => useShapeBuilderTool(opts));
  const paths: Record<string, Path> = { a: rect(0, 0, 10, 10), b: rect(5, 0, 10, 10) };
  let n = 0;
  const createPathNode = vi.fn((path: Path, _op: string, sourceId: string) => ({ id: `made${n++}`, path, sourceId }));
  const applyOps = vi.fn();
  const adapter: BooleansAdapter = {
    ...rootsTree(['a', 'b']),
    getSelection: () => ids as NodeId[],
    getWorldPath: (id) => paths[id],
    compareZ: (x, y) => x.localeCompare(y),
    getNode: (id) => ({ id }),
    createPathNode,
    applyOps,
  };
  const deps = {
    booleansAdapter: adapter,
    selection: { get: () => ids },
    view: { get: () => VIEW, set: () => {} },
  } as unknown as ActionDeps;
  const actionOf = (id: string): Action => {
    const a = (result.current.actions ?? []).find((x) => x.id === id);
    if (!a) throw new Error(`${id} not declared on the tool`);
    return a;
  };
  const enabled = (id: string) => actionOf(id).enabled?.(deps) ?? true;
  const fire = (id: string, params?: Record<string, unknown>) => {
    const inv = actionOf(id).invoker;
    if (inv?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
    inv.run(deps, params);
  };
  const at = (x: number, y: number, alt = false): InvocationCtx =>
    ({ world: { x, y }, modifiers: { ...noMods, alt }, deps } as InvocationCtx);
  /** Drag through `run`, holding Alt from the start when `alt`. */
  const drag = (run: [number, number][], alt = false): OngoingHandle => {
    const inv = actionOf('shapeBuilder').invoker;
    if (inv?.timing !== 'ongoing') throw new Error('shapeBuilder is not ongoing');
    const [first, ...rest] = run;
    const handle = inv.start(at(first![0], first![1], alt));
    for (const [x, y] of rest) handle.onMove?.(at(x, y, alt));
    return handle;
  };
  const painted = () =>
    ((result.current.overlay as RenderLayer<unknown>).draw(null, VIEW, { width: 100, height: 100, dpr: 1 }) as PathDrawCommand[])
      .map((c) => [c.fill?.paint, boundsOfPath(c.path).x, boundsOfPath(c.path).width]);
  const made = () => createPathNode.mock.calls.map(([path, op, src]) => [op, src, boundsOfPath(path).x, boundsOfPath(path).width]);
  return { tool: () => result.current, enabled, fire, drag, painted, made, applyOps };
}

describe('useShapeBuilderTool', () => {
  it('declares capabilities: [edits-page]', () => {
    expect(setup().tool().eligibility.capabilities).toEqual(['edits-page']);
  });

  it('shows the face under the pointer, red while Alt is held, and nothing off every face', () => {
    const s = setup();
    s.fire('shapeBuilder.hover', { worldX: 7, worldY: 5, mods: noMods });
    expect(s.painted()).toEqual([[expect.anything(), 5, 5]]);
    const plain = s.painted()[0]![0];
    s.fire('shapeBuilder.hover', { worldX: 7, worldY: 5, mods: { ...noMods, alt: true } });
    expect(s.painted()[0]![0]).not.toEqual(plain);
    s.fire('shapeBuilder.hover', { worldX: 40, worldY: 5, mods: noMods });
    expect(s.painted()).toEqual([]);
  });

  it('unites the faces a drag crosses and keeps the face it misses, as one undo step', () => {
    const s = setup();
    const handle = s.drag([[13, 5], [7, 5]]);
    expect(s.painted().map(([, x, w]) => [x, w])).toEqual([[10, 5], [5, 5]]);
    handle.onEnd?.(handleEndCtx(), 'commit');
    expect(s.made()).toEqual([['divide', 'a', 0, 5], ['union', 'b', 5, 10]]);
    expect(s.applyOps).toHaveBeenCalledTimes(1);
    expect(s.painted()).toEqual([]);
  });

  it('deletes the faces an Alt-drag crosses', () => {
    const s = setup();
    s.drag([[7, 5], [7, 8]], true).onEnd?.(handleEndCtx(), 'commit');
    expect(s.made()).toEqual([['divide', 'a', 0, 5], ['divide', 'b', 10, 5]]);
  });

  it('deletes on a plain drag and unites on an Alt-drag under mode delete', () => {
    const plain = setup(['a', 'b'], { mode: 'delete' });
    plain.drag([[7, 5], [7, 8]]).onEnd?.(handleEndCtx(), 'commit');
    expect(plain.made()).toEqual([['divide', 'a', 0, 5], ['divide', 'b', 10, 5]]);
    const alt = setup(['a', 'b'], { mode: 'delete' });
    alt.drag([[13, 5], [7, 5]], true).onEnd?.(handleEndCtx(), 'commit');
    expect(alt.made()).toEqual([['divide', 'a', 0, 5], ['union', 'b', 5, 10]]);
  });

  it('commits nothing for a canceled drag', () => {
    const s = setup();
    s.drag([[13, 5], [2, 5]]).onEnd?.(handleEndCtx(), 'cancel');
    expect(s.applyOps).not.toHaveBeenCalled();
    expect(s.painted()).toEqual([]);
  });

  it('takes the one face a click lands on', () => {
    const s = setup();
    s.fire('shapeBuilder.click', { pressX: 2, pressY: 5, mods: { ...noMods, alt: true } });
    expect(s.made()).toEqual([['divide', 'b', 10, 5], ['divide', 'b', 5, 5]]);
  });

  it('declines its drag and click with fewer than two selected, so the drag marquee-selects', () => {
    const s = setup(['a']);
    expect(s.enabled('shapeBuilder')).not.toBe(true);
    expect(s.enabled('shapeBuilder.click')).not.toBe(true);
    expect(s.tool().bindings!.map((b) => b.actionId)).toContain('areaSelect');
  });

  it('clears what it shows when the tool is put down', () => {
    const s = setup();
    s.fire('shapeBuilder.hover', { worldX: 7, worldY: 5, mods: noMods });
    s.tool().onDeactivate?.();
    expect(s.painted()).toEqual([]);
  });

  it('reports no route conflicts for the drag declared ahead of the marquee', () => {
    const { result } = renderHook(() => useShapeBuilderTool());
    expect(reportRouteConflicts({ registry: [result.current] }, () => {})).toEqual([]);
  });
});

function handleEndCtx(): InvocationCtx {
  return { world: { x: 0, y: 0 }, modifiers: noMods, deps: {} } as InvocationCtx;
}
