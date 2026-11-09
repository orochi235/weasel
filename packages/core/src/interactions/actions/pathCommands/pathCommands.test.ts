import { describe, expect, it, vi } from 'vitest';
import { PathBuilder, boundsOfPath, countPathAnchors, pathToAnchors, rectPath, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';
import { simplifyPathAction, offsetPathAction } from './simplifyOffset';
import { joinPathsAction, snipAtCrossingsAction } from './cutJoin';

interface StubNode { id: NodeId; kind: 'mark'; layer: string; pose: unknown; data: unknown; parent: NodeId | null }

type Stored = { pose: unknown; data: unknown };

/** A scene whose nodes store their polygon as the pose, or as given, in the order given. */
function setup(paths: Record<string, PolygonPath | Stored>, selected: string[], extra: Record<string, unknown> = {}) {
  const nodes = new Map<string, StubNode>();
  for (const [id, path] of Object.entries(paths)) {
    const stored = 'kind' in path ? { pose: path, data: { tag: id, skin: [1], constraints: [{ kind: 'fixed', anchor: 0 }] } } : path;
    nodes.set(id, { id: asNodeId(id), kind: 'mark', layer: 'main', ...stored, parent: null });
  }
  let minted = 0;
  const scene = {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: () => [],
    get roots() { return [...nodes.keys()].map(asNodeId); },
    mintId: () => asNodeId(`new-${++minted}`),
    applyBatch: vi.fn(),
  };
  let current = selected;
  const selection = { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
  const batches: Array<{ ops: Op[]; label: string }> = [];
  const applyOps = vi.fn((ops: Op[], label: string) => { batches.push({ ops, label }); });
  const deps = { scene, selection, applyOps, ...extra } as unknown as InvocationCtx['deps'];
  return { deps, batches, selection };
}

const ctx = (deps: InvocationCtx['deps'], params?: Record<string, unknown>): InvocationCtx => ({
  world: { x: 0, y: 0 },
  screen: { x: 0, y: 0 },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps,
  ...(params ? { params } : {}),
});

const args = (op: Op) => op.args as { id?: string; to?: unknown; node?: StubNode; slot?: unknown };

function circle(n: number, r: number): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (i === 0) b.moveTo(r * Math.cos(a), r * Math.sin(a)); else b.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  return b.close().build();
}
const square = (s: number) => new PathBuilder().moveTo(0, 0).lineTo(s, 0).lineTo(s, s).lineTo(0, s).close().build();
const line = (x0: number, y0: number, x1: number, y1: number) => new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();

describe('simplifyPathAction', () => {
  const ongoing = simplifyPathAction.invoker as OngoingInvoker;

  it('answers the same preview objects until the tolerance moves', () => {
    const { deps } = setup({ a: circle(120, 50) }, ['a']);
    const handle = ongoing.start(ctx(deps, { tolerance: 0.01 }), {});
    expect(handle.previewPose!('a')).toBe(handle.previewPose!('a'));
    expect(handle.previewData!('a')).toBe(handle.previewData!('a'));
  });

  it('previews the refit as the tolerance moves and commits once', () => {
    const { deps, batches } = setup({ a: circle(120, 50) }, ['a']);
    const handle = ongoing.start(ctx(deps, { tolerance: 0.01 }), {});
    const tight = pathToAnchors(handle.previewPose!('a') as PolygonPath).anchors[0].length;
    handle.onMove!(ctx(deps, { tolerance: 2 }));
    const loose = pathToAnchors(handle.previewPose!('a') as PolygonPath).anchors[0].length;
    expect(loose).toBeLessThan(tight);
    expect(batches).toHaveLength(0);
    handle.onEnd!(ctx(deps), 'commit');
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Simplify');
    const [reshape, data] = batches[0].ops.map(args);
    expect(pathToAnchors(reshape.to as PolygonPath).anchors[0]).toHaveLength(loose);
    expect(data.to).toEqual({ tag: 'a' });
  });

  it('commits nothing on cancel, and is disabled with no path selected', () => {
    const { deps, batches } = setup({ a: circle(60, 50) }, ['a']);
    const handle = ongoing.start(ctx(deps, { tolerance: 1 }), {});
    handle.onEnd!(ctx(deps), 'cancel');
    expect(batches).toHaveLength(0);
    expect(simplifyPathAction.enabled!(setup({ a: circle(60, 50) }, []).deps)).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('offsetPathAction', () => {
  const ongoing = offsetPathAction.invoker as OngoingInvoker;

  it('adds a grown copy behind the source, keeping the source in view, and selects it', () => {
    const { deps, batches } = setup({ a: square(100), b: square(10) }, ['b']);
    const handle = ongoing.start(ctx(deps, { distance: 0 }), {});
    expect(handle.previewIds!()).toBeNull();
    expect(handle.previewHidesSource).toBe(false);
    handle.onMove!(ctx(deps, { distance: 5 }));
    expect([...handle.previewIds!()!]).toEqual(['b']);
    handle.onEnd!(ctx(deps), 'commit');
    const [insert] = batches[0].ops.map(args);
    expect(insert.node!.id).toBe('new-1');
    expect(insert.slot).toEqual({ index: 1 });
    expect(insert.node!.data).toEqual({ tag: 'b' });
    expect((batches[0].ops.at(-1)!.args as { to: readonly string[] }).to).toEqual(['new-1']);
  });

  it('offsets a rectangle stored as a rect path, the copy holding a polygon', () => {
    const rect = { pose: { x: 10, y: 10, width: 20, height: 20 }, data: { path: rectPath(0, 0, 20, 20) } };
    const { deps, batches } = setup({ a: rect }, ['a']);
    const handle = ongoing.start(ctx(deps, { distance: 5 }), {});
    handle.onEnd!(ctx(deps), 'commit');
    const copy = args(batches[0].ops[0]).node!;
    const path = (copy.data as { path: PolygonPath }).path;
    expect(path.kind).toBe('polygon');
    expect(copy.pose).toMatchObject({ x: 5, y: 5, width: 30, height: 30 });
    expect(boundsOfPath(path)).toMatchObject({ width: 30, height: 30 });
  });

  it('puts a shrunk copy in front of its source', () => {
    const { deps, batches } = setup({ a: square(100) }, ['a']);
    const handle = ongoing.start(ctx(deps, { distance: -10 }), {});
    handle.onEnd!(ctx(deps), 'commit');
    expect(args(batches[0].ops[0]).slot).toEqual({ index: 1 });
  });
});

describe('snipAtCrossingsAction', () => {
  it('replaces each crossed path with its pieces and selects them', () => {
    const { deps, batches } = setup({ a: line(0, 0, 10, 10), b: line(0, 10, 10, 0) }, ['a', 'b']);
    (snipAtCrossingsAction.invoker as ImmediateInvoker).run(deps);
    const ops = batches[0].ops;
    expect(ops.map((o) => o.name)).toEqual(['delete', 'insert', 'insert', 'delete', 'insert', 'insert', 'setSelection']);
    expect((ops.at(-1)!.args as { to: readonly string[] }).to).toEqual(['new-3', 'new-4', 'new-1', 'new-2']);
  });

  it('needs two paths', () => {
    expect(snipAtCrossingsAction.enabled!(setup({ a: line(0, 0, 1, 1) }, ['a']).deps)).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('joinPathsAction', () => {
  const run = (deps: InvocationCtx['deps']) => (joinPathsAction.invoker as ImmediateInvoker).run(deps);

  it('joins two paths at their nearest ends into the first and deletes the second', () => {
    const { deps, batches } = setup({ a: line(0, 0, 10, 0), b: line(30, 0, 12, 0) }, ['a', 'b']);
    run(deps);
    const ops = batches[0].ops;
    expect(ops.map((o) => o.name)).toEqual(['transform', 'setData', 'delete', 'setSelection']);
    const joined = pathToAnchors(args(ops[0]).to as PolygonPath);
    expect(joined.anchors[0].map((a) => a.x)).toEqual([0, 10, 12, 30]);
    expect((ops.at(-1)!.args as { to: readonly string[] }).to).toEqual(['a']);
  });

  it('closes a lone open path', () => {
    const open = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    const { deps, batches } = setup({ a: open }, ['a']);
    run(deps);
    expect(pathToAnchors(args(batches[0].ops[0]).to as PolygonPath).closed).toEqual([true]);
  });

  it('has nothing to join on a closed path, three paths, or in path edit', () => {
    expect(joinPathsAction.enabled!(setup({ a: square(10) }, ['a']).deps)).toBe(ActionDisabledReason.NotApplicable);
    const three = setup({ a: line(0, 0, 1, 0), b: line(2, 0, 3, 0), c: line(4, 0, 5, 0) }, ['a', 'b', 'c']);
    expect(joinPathsAction.enabled!(three.deps)).toBe(ActionDisabledReason.NotApplicable);
    const editing = setup({ a: line(0, 0, 1, 0) }, ['a'], { editAnchors: { editingId: 'a' } });
    expect(joinPathsAction.enabled!(editing.deps)).toBe(ActionDisabledReason.NotApplicable);
  });
});

describe('per-anchor stroke data on the pieces a command makes', () => {
  const tapered = (path: PolygonPath, vertexWidths: number[], vertexColors: number[]): Stored => ({
    pose: path, data: { stroke: { width: 2, vertexWidths, vertexColors } },
  });
  const strokeOf = (node: StubNode | undefined) =>
    (node!.data as { stroke: { width: number; vertexWidths?: unknown; vertexColors?: unknown } }).stroke;

  it('cuts a tapered stroke\'s widths and colors to each piece Cut at Crossings makes, blending at the cut', () => {
    const a = tapered(line(0, 0, 10, 0), [1, 3], [0, 0, 0, 1, 1, 1, 1, 1]);
    const { deps, batches } = setup({ a, b: line(5, -5, 5, 5) }, ['a', 'b']);
    (snipAtCrossingsAction.invoker as ImmediateInvoker).run(deps);
    const pieces = batches[0].ops.filter((o) => o.name === 'insert').map((o) => args(o).node!)
      .filter((n) => (n.data as { stroke?: unknown }).stroke !== undefined)
      .map(strokeOf);
    expect(pieces).toHaveLength(2);
    const byStart = pieces.sort((p, q) => (p.vertexWidths as number[])[0] - (q.vertexWidths as number[])[0]);
    expect(byStart[0].vertexWidths).toEqual([1, 2]);
    expect(byStart[1].vertexWidths).toEqual([2, 3]);
    expect(byStart[0].vertexColors).toEqual([0, 0, 0, 1, 0.5, 0.5, 0.5, 1]);
    expect(byStart[0].width).toBe(2);
  });

  it('blends a closed stroke\'s widths where a cut opens it, the closing edge included', () => {
    const a = tapered(square(10), [1, 2, 3, 4], []);
    const { deps, batches } = setup({ a, b: line(-5, 5, 15, 5) }, ['a', 'b']);
    (snipAtCrossingsAction.invoker as ImmediateInvoker).run(deps);
    const pieces = batches[0].ops.filter((o) => o.name === 'insert').map((o) => args(o).node!)
      .filter((n) => (n.data as { stroke?: unknown }).stroke !== undefined);
    const widths = pieces.map((n) => strokeOf(n).vertexWidths as number[]);
    pieces.forEach((n, i) => expect(widths[i]).toHaveLength(countPathAnchors(n.pose as PolygonPath)));
    expect(widths.flat().filter((w) => !Number.isInteger(w)).sort()).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  it('gives an offset copy widths and colors only when they line up with its own anchors', () => {
    const { deps, batches } = setup({ a: tapered(circle(12, 20), new Array(12).fill(1), new Array(48).fill(1)) }, ['a']);
    const handle = (offsetPathAction.invoker as OngoingInvoker).start(ctx(deps, { distance: 3 }), {});
    handle.onEnd!(ctx(deps), 'commit');
    const copy = args(batches[0].ops[0]).node!;
    const anchors = countPathAnchors(copy.pose as PolygonPath);
    const stroke = strokeOf(copy);
    expect([undefined, anchors]).toContain((stroke.vertexWidths as unknown[] | undefined)?.length);
    expect([undefined, anchors * 4]).toContain((stroke.vertexColors as unknown[] | undefined)?.length);
    expect(stroke.width).toBe(2);
  });

  it('drops widths a simplified path no longer has the anchors for', () => {
    const { deps, batches } = setup({ a: tapered(circle(120, 50), new Array(120).fill(2), []) }, ['a']);
    const handle = (simplifyPathAction.invoker as OngoingInvoker).start(ctx(deps, { tolerance: 2 }), {});
    handle.onEnd!(ctx(deps), 'commit');
    const data = batches[0].ops.map(args).find((x) => x.to && (x.to as { stroke?: unknown }).stroke)!.to as { stroke: { vertexWidths?: unknown } };
    expect(data.stroke.vertexWidths).toBeUndefined();
  });
});
