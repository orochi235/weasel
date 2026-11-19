/** What a copy captures and where a paste lands it. */
import { describe, expect, it } from 'vitest';
import { linePath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { DerivedDep, Node, RectPose, Scene } from 'core/scene/types';
import type { PasteOmission } from 'core/adapters/types';
import { sceneToAdapter } from './sceneAdapter';

type D = { label: string };
type S = Scene<D, 'main', RectPose>;

const rect = (x: number, y = 0): RectPose => ({ x, y, width: 10, height: 10 });
const between = (_n: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
  const from = deps[0]?.pose;
  const to = deps[1]?.pose;
  return from && to ? linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y }) : null;
};

function paste(scene: S, ids: string[], ctx?: { dropPoint?: { x: number; y: number } }) {
  const adapter = sceneToAdapter(scene);
  const omitted: PasteOmission[] = [];
  const created = adapter.commitPaste(adapter.snapshotSelection(ids), { dx: 0, dy: 0 }, { ...ctx, onOmit: (o) => omitted.push(o) });
  return { created, omitted, byLabel: new Map(created.map((n) => [n.data.label, n])) };
}

describe('copying with a page selected', () => {
  it('carries the hidden source of a derived node on that page', () => {
    const scene: S = createScene<D, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const page = scene.add({ kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 500, height: 500 }, data: { label: 'page' }, page: {} } as never);
    const a = scene.add({ kind: 'mark', layer: 'main', parent: page, pose: rect(0), data: { label: 'a' } });
    const h = scene.add({ kind: 'mark', layer: 'main', parent: page, pose: rect(100), data: { label: 'h' } });
    scene.setHidden(h, true);
    const edge = scene.add({
      kind: 'mark', layer: 'main', parent: page, pose: rect(0), data: { label: 'edge' }, dependsOn: [a, h], derivePath: between,
    });
    const { byLabel, omitted } = paste(scene, [page, a, edge]);
    expect(omitted).toEqual([]);
    expect(byLabel.has('edge')).toBe(true);
  });
});
