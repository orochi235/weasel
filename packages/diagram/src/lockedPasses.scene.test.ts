import { describe, expect, it } from 'vitest';
import { createScene, createTransformOp, renamePage, type RectPose, type Scene } from '@weasel-js/core';
import { installAvoidRouting } from './avoid/install';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from './edge';
import { edgeLabelSpec } from './edgeLabel';
import type { DiagramEdge } from './edgeTrait';
import { installHops } from './hops/install';
import { HOPS_DOC_KEY } from './hops/types';
import { diagramLabelOf } from './labelTrait';
import { installLabelPlacement } from './labels/install';
import { installOffPageMarkers } from './offPage/install';
import { dragTo, pagedScene } from './offPage/pagedFixture';

type TwoLayers = Scene<unknown, string, RectPose>;

const box = (id: string, layer: string, x: number, y: number, width = 100, height = 60) =>
  ({ id, kind: 'mark', layer, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, layer: string, extra: Partial<DiagramEdge> = {}) => ({
  id, kind: 'mark', layer, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: { port: 'e' }, to: { port: 'w' }, ...extra } },
  dependsOn: [from, to],
  derivePath: EDGE_DERIVE_PATH,
});

/** `a` and `b` joined by `ab` on layer `wires`, which is locked; `c` and `d` on `main`, which is not. */
function load(extra: Partial<DiagramEdge> = {}, doc?: Record<string, unknown>, wiresOnTop = false): TwoLayers {
  const scene: TwoLayers = createScene<unknown, string, RectPose>({
    systemLayers: wiresOnTop ? [{ id: 'main' }, { id: 'wires' }] : [{ id: 'wires' }, { id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 'wires', 0, 0), box('b', 'wires', 400, 0), box('c', 'main', 1000, 1000, 40, 24),
      box('d', 'main', 1200, 1200), connector('ab', 'a', 'b', 'wires', extra), edgeLabelSpec('ab', 'note', { layer: 'wires' }),
    ] as never,
    ...(doc ? { doc } : {}),
  });
  return scene;
}

/** Moves unlocked `c` onto the middle of the locked connector, where its label sits. */
function coverWire(scene: TwoLayers): void {
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  const from = scene.get('c' as never)!.pose;
  scene.applyBatch([createTransformOp({ id: 'c', from, to: { x: 230, y: -10, width: 40, height: 24 } })], 'Move', adapter);
}

const trait = (scene: TwoLayers, id = 'ab') => (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram;

describe('the diagram edit passes beside a locked connector', () => {
  it('route the connectors that are free and leave a locked one’s route as it stands', () => {
    const scene = load({ router: 'avoid' });
    installAvoidRouting(scene);
    scene.setLayerLocked('wires', true);
    expect(() => coverWire(scene)).not.toThrow();
    expect(scene.get('c' as never)!.pose.x).toBe(230);
    expect(trait(scene).route).toBeUndefined();
  });

  it('place the labels that are free and leave a locked one where it stands', () => {
    const scene = load();
    installLabelPlacement(scene);
    scene.setLayerLocked('wires', true);
    expect(() => coverWire(scene)).not.toThrow();
    expect(scene.get('c' as never)!.pose.x).toBe(230);
    expect(diagramLabelOf(scene.get('ab/label' as never)!)!.placed).toBeUndefined();
  });

  it('hop the connectors that are free and leave a locked one unhopped', () => {
    const scene = load({}, { [HOPS_DOC_KEY]: { size: 5 } }, true);
    scene.add(connector('cd', 'c', 'd', 'main', { from: { port: 's' }, to: { port: 'n' } }) as never);
    installHops(scene);
    scene.setLayerLocked('wires', true);
    // Drawn above `cd`, the locked `ab` is the one that would hop where they cross.
    const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
    const from = scene.get('d' as never)!.pose;
    expect(() => scene.applyBatch([createTransformOp({ id: 'd', from, to: { ...from, x: 230, y: 300 } })], 'Move', adapter)).not.toThrow();
    const c = scene.get('c' as never)!.pose;
    expect(() => scene.applyBatch([createTransformOp({ id: 'c', from: c, to: { ...c, x: 230, y: -300 } })], 'Move', adapter)).not.toThrow();
    expect(scene.get('c' as never)!.pose.y).toBe(-300);
    expect(trait(scene).hops).toBeUndefined();
  });

  it('leave a locked split connector and its tags as they are when a page is renamed', () => {
    const scene = pagedScene([
      box('a', 'main', 20, 20, 40, 30), box('b', 'main', 120, 20, 40, 30), connector('ab', 'a', 'b', 'main', { from: {}, to: {} }),
    ]);
    installOffPageMarkers(scene, { look: () => ({ style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: '#111111', background: '#ffffff' }) });
    dragTo(scene, 'b', 300);
    const tag = () => (scene.get('ab/offpage-from' as never)!.data as { text?: string }).text;
    expect(tag()).toBe('Page 2 · A');
    for (const id of ['ab', 'ab/offpage-from', 'ab/offpage-to']) scene.setLocked(id as never, true);
    expect(() => renamePage(scene, 'p2', 'Appendix')).not.toThrow();
    expect(tag()).toBe('Page 2 · A');
  });
});
