import { describe, expect, it } from 'vitest';
import { createScene, createTransformOp, documentPose, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { edgeLabelSpec } from '../edgeLabel';
import { diagramLabelOf, type DiagramLabel } from '../labelTrait';
import { installLabelPlacement } from './install';

type LabelScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string) => ({
  id: id as never,
  kind: 'leaf' as const,
  layer: 'main' as const,
  pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: { port: 'e' }, to: { port: 'w' }, router: 'straight' } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

function load(label: DiagramLabel = { at: 'mid', offset: 9 }) {
  const scene: LabelScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    initial: [
      box('a', 0, 0), box('b', 400, 0), box('c', 1000, 1000, 40, 24), connector('ab', 'a', 'b'),
      edgeLabelSpec('ab', 'note', { layer: 'main', label }),
    ] as never,
  });
  const placement = installLabelPlacement(scene);
  const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(id as never, pose) };
  const move = (id: string, to: RectPose) =>
    scene.applyBatch([createTransformOp({ id, from: scene.get(id as never)!.pose, to })], 'Move', adapter);
  return { scene, placement, move };
}

const labelOf = (scene: LabelScene) => diagramLabelOf(scene.get('ab/label' as never)!)!;
const labelBox = (scene: LabelScene) => documentPose(scene, scene.get('ab/label' as never)!);
const overlaps = (a: RectPose, b: RectPose) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('label placement in a scene', () => {
  it('re-places a label a move covers, in the move’s own entry, and undo puts it back', () => {
    const { scene, move } = load();
    const cover = { x: 230, y: -10, width: 40, height: 24 };
    expect(overlaps(labelBox(scene), cover)).toBe(true);
    const depth = scene.historyEntries().length;
    move('c', cover);
    expect(scene.historyEntries().length).toBe(depth + 1);
    expect(labelOf(scene).placed).toEqual({ at: 0.5, offset: -9 });
    expect(overlaps(labelBox(scene), cover)).toBe(false);
    scene.undo();
    expect(labelOf(scene).placed).toBeUndefined();
    expect(scene.get('c' as never)!.pose).toEqual({ x: 1000, y: 1000, width: 40, height: 24 });
  });

  it('sends a label back to its preference once what covered it leaves', () => {
    const { scene, move } = load();
    move('c', { x: 230, y: -10, width: 40, height: 24 });
    move('c', { x: 1000, y: 1000, width: 40, height: 24 });
    expect(labelOf(scene).placed).toBeUndefined();
  });

  it('leaves a label that opts out where it is', () => {
    const { scene, move } = load({ at: 'mid', offset: 9, dodge: false });
    move('c', { x: 230, y: -10, width: 40, height: 24 });
    expect(labelOf(scene).placed).toBeUndefined();
  });

  it('writes nothing for an edit that covers no label', () => {
    const { scene, move } = load();
    const before = scene.get('ab/label' as never)!.data;
    move('c', { x: 1200, y: 1000, width: 40, height: 24 });
    expect(scene.get('ab/label' as never)!.data).toBe(before);
  });

  it('stops placing once disposed', () => {
    const { scene, placement, move } = load();
    placement.dispose();
    move('c', { x: 230, y: -10, width: 40, height: 24 });
    expect(labelOf(scene).placed).toBeUndefined();
  });
});
