/**
 * Copy and paste of nodes that carry something a plain copy loses: a
 * derivation over an id list, and a container's layout.
 */
import { describe, expect, it } from 'vitest';
import { sceneToAdapter } from './sceneAdapter';
import { createScene } from 'core/scene/scene';
import type { PasteOmission } from 'core/adapters/types';
import type { DerivedDep, Node, RectPose, Scene } from 'core/scene/types';
import type { LayoutStrategy } from '../layout/types';
import { materializePaste } from 'interactions/actions/clipboard/materializePaste';
import { applyOpsTo } from 'core/applyOps';
import { linePath } from '@weasel-js/geom';

type D = { label: string };
type S = Scene<D, 'main', RectPose>;
type N = Node<D, 'main', RectPose>;

const OFFSET = { dx: 12, dy: 12 };
const rect = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

const between = (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
  const from = deps[0]?.pose;
  const to = deps[1]?.pose;
  return from && to ? linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y }) : null;
};
const beside = (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) =>
  deps[0] ? { ...deps[0].pose, y: deps[0].pose.y + 20 } : null;

const ROW = { childPoses: () => [] } as unknown as LayoutStrategy<RectPose>;

/** `a` and `b`, an edge between them, and a label that follows the edge. */
function makeScene(registry: Parameters<typeof createScene<D, 'main', RectPose>>[0]['registry'] = {}) {
  const scene: S = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: rect(0), data: { label: 'a' } });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: rect(100), data: { label: 'b' } });
  const edge = scene.add({
    kind: 'mark', layer: 'main', pose: rect(0), data: { label: 'edge' },
    dependsOn: [a, b], derivePath: between,
  });
  const label = scene.add({
    kind: 'mark', layer: 'main', pose: rect(0), data: { label: 'label' },
    dependsOn: [edge], derivePose: beside as never,
  });
  return { scene, a, b, edge, label };
}

function paste(scene: S, items: unknown[]) {
  const adapter = sceneToAdapter(scene);
  const omitted: PasteOmission[] = [];
  const created = adapter.commitPaste({ items }, OFFSET, { onOmit: (o) => omitted.push(o) });
  const byLabel = new Map(created.map((n) => [n.data.label, n]));
  return { created, omitted, byLabel };
}

const copy = (scene: S, ids: string[]) => sceneToAdapter(scene).snapshotSelection(ids).items;
const overTheWire = (items: unknown[]) => JSON.parse(JSON.stringify(items)) as unknown[];

describe('pasting a derived node', () => {
  it('re-points an edge at the pasted copies of what it depends on', () => {
    const { scene, a, b, edge } = makeScene();
    const { byLabel, omitted } = paste(scene, copy(scene, [a, b, edge]));
    const pasted = byLabel.get('edge')!;
    expect(pasted.dependsOn).toEqual([byLabel.get('a')!.id, byLabel.get('b')!.id]);
    expect(pasted.derivePath).toBe(between);
    expect(omitted).toEqual([]);
  });

  it('drops an edge when a node it depends on was not copied, and says so', () => {
    const { scene, a, b, edge } = makeScene();
    const { created, omitted } = paste(scene, copy(scene, [a, edge]));
    expect(created.map((n) => n.data.label)).toEqual(['a']);
    expect(omitted).toEqual([{ id: edge, reason: 'dependency-not-copied', missing: [b] }]);
  });

  it('carries the hidden nodes a copied node depends on, still hidden, since none can be selected', () => {
    const { scene, a, b, edge } = makeScene();
    scene.setHidden(b, true);
    const { byLabel, omitted } = paste(scene, copy(scene, [a, edge]));
    expect(omitted).toEqual([]);
    expect(byLabel.get('b')!.hidden).toBe(true);
    expect(byLabel.get('edge')!.dependsOn).toEqual([byLabel.get('a')!.id, byLabel.get('b')!.id]);
  });

  it('carries hidden sources through a chain, and copies each once', () => {
    const { scene, a, b, edge, label } = makeScene();
    scene.setHidden(edge, true);
    scene.setHidden(b, true);
    const items = copy(scene, [a, label]) as { id: string }[];
    expect(items.map((n) => n.id).sort()).toEqual([a, b, edge, label].sort());
    expect(items.findIndex((n) => n.id === edge)).toBeLessThan(items.findIndex((n) => n.id === label));
  });

  it('drops what depended on a dropped node', () => {
    const { scene, a, b, edge, label } = makeScene();
    const { created, omitted } = paste(scene, copy(scene, [a, edge, label]));
    expect(created.map((n) => n.data.label)).toEqual(['a']);
    expect(omitted).toEqual([
      { id: edge, reason: 'dependency-not-copied', missing: [b] },
      { id: label, reason: 'dependency-not-copied', missing: [edge] },
    ]);
  });

  it('keeps a pose derivation over an id list', () => {
    const { scene, a, b, edge, label } = makeScene();
    const { byLabel } = paste(scene, copy(scene, [a, b, edge, label]));
    const pasted = byLabel.get('label')!;
    expect(pasted.dependsOn).toEqual([byLabel.get('edge')!.id]);
    expect(pasted.derivePose).toBe(beside);
  });

  it('pastes a second time from what the first paste made', () => {
    const { scene, a, b, edge } = makeScene();
    const first = paste(scene, copy(scene, [a, b, edge]));
    const second = paste(scene, first.created);
    expect(second.byLabel.get('edge')!.dependsOn)
      .toEqual([second.byLabel.get('a')!.id, second.byLabel.get('b')!.id]);
  });
});

describe('pasting across the wire format', () => {
  it('restores a registered derivation by its key', () => {
    const { scene, a, b, edge } = makeScene({ derivePath: { between } });
    const { byLabel, omitted } = paste(scene, overTheWire(copy(scene, [a, b, edge])));
    expect(byLabel.get('edge')!.derivePath).toBe(between);
    expect(omitted).toEqual([]);
  });

  it('drops a derived node whose function did not survive, and says so', () => {
    const { scene, a, b, edge } = makeScene();
    const { created, omitted } = paste(scene, overTheWire(copy(scene, [a, b, edge])));
    expect(created.map((n) => n.data.label)).toEqual(['a', 'b']);
    expect(omitted).toEqual([{ id: edge, reason: 'derivation-not-registered' }]);
  });
});

describe('pasting a layout container', () => {
  function withRow(registry: Parameters<typeof makeScene>[0] = {}) {
    const scene: S = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry });
    const row = scene.add({ kind: 'group', layer: 'main', pose: rect(0), data: { label: 'row' } });
    scene.add({ kind: 'mark', layer: 'main', pose: rect(0), data: { label: 'kid' }, parent: row });
    // Attached directly: these tests are about what a copy carries, not about arranging.
    (scene.get(row) as { layout?: LayoutStrategy<RectPose> }).layout = ROW;
    return { scene, row };
  }

  it('carries the layout to the copy', () => {
    const { scene, row } = withRow();
    const pasted = paste(scene, copy(scene, [row])).byLabel.get('row') as N & { layout?: unknown };
    expect(pasted.layout).toBe(ROW);
  });

  it('pastes no layout when an unregistered one crossed the wire', () => {
    const { scene, row } = withRow();
    const pasted = paste(scene, overTheWire(copy(scene, [row]))).byLabel.get('row') as N & { layout?: unknown };
    expect(pasted.layout).toBeUndefined();
  });

  it('restores a registered layout by its key across the wire', () => {
    const { scene, row } = withRow({ layout: { row: ROW } });
    const pasted = paste(scene, overTheWire(copy(scene, [row]))).byLabel.get('row') as N & { layout?: unknown };
    expect(pasted.layout).toBe(ROW);
  });
});

describe('pasting a container that declares a unit scope', () => {
  it('carries the scope to the copy, across the wire too', () => {
    const scene: S = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const units = { system: { base: 'mm', units: { mm: 1 } }, scale: 0.5 };
    const box = scene.add({ kind: 'group', layer: 'main', pose: rect(0), data: { label: 'box' }, units });
    const pasted = paste(scene, overTheWire(copy(scene, [box]))).byLabel.get('box') as N & { units?: unknown };
    expect(pasted.units).toEqual(units);
  });
});

describe('materializePaste', () => {
  it('reports what the paste left out, even when it made nothing', () => {
    const { scene, a, b, edge } = makeScene();
    const adapter = sceneToAdapter(scene);
    const reported: PasteOmission[][] = [];
    const result = materializePaste(adapter, adapter.snapshotSelection([edge]), {
      currentSelection: [],
      onOmitted: (o) => reported.push(o),
    });
    expect(result).toBeNull();
    expect(reported).toEqual([[{ id: edge, reason: 'dependency-not-copied', missing: [a, b] }]]);
  });

  it('inserts a pasted edge that follows the pasted nodes', () => {
    const { scene, a, b, edge } = makeScene();
    const adapter = sceneToAdapter(scene);
    const result = materializePaste(adapter, adapter.snapshotSelection([a, b, edge]), { currentSelection: [] })!;
    applyOpsTo(adapter, result.ops);
    const pasted = result.created.find((n) => n.data.label === 'edge')!;
    const live = scene.get(pasted.id)!;
    expect(live.derivePath).toBe(between);
    expect(live.dependsOn).toEqual(pasted.dependsOn);
  });
});
