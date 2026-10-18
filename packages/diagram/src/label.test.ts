import { describe, it, expect } from 'vitest';
import {
  asNodeId, createScene, effectivePose, polylineFromPoints, type DerivedDep, type Path, type RectPose, type Vec2,
} from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { DIAGRAM_LABEL, LABEL_DERIVE_POSE, labelDerivePose } from './label';
import { diagramLabelOf } from './labelTrait';

const box = (x: number, y: number, w = 20, h = 8): RectPose => ({ x, y, width: w, height: h });

/** A dependency carrying a path, the way an edge reaches its label. */
const edgeDep = (path: Path | null): DerivedDep<RectPose> => ({
  node: { id: asNodeId('e'), kind: 'leaf', layer: 'main', parent: null, pose: box(0, 0), data: {} } as never,
  pose: box(0, 0),
  path,
});

/** 100 across, then 100 down. */
const elbow = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
const line = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]);

const labelNode = (label: unknown, pose: RectPose = box(0, 0)) =>
  ({ pose, data: { diagram: { label } } });

const derive = labelDerivePose<RectPose>();
const poseOf = (label: unknown, dep: DerivedDep<RectPose> | undefined, pose?: RectPose) =>
  derive(labelNode(label, pose) as never, [dep]);

describe('diagramLabelOf', () => {
  it('reads a label trait', () => {
    expect(diagramLabelOf({ data: { diagram: { label: { at: 'mid' } } } })).toEqual({ at: 'mid' });
  });

  it('is null for an edge trait, which names ends rather than a station', () => {
    expect(diagramLabelOf({ data: { diagram: { from: {}, to: {} } } })).toBeNull();
  });
});

describe('labelDerivePose', () => {
  it('centers the label on the middle of the route', () => {
    // Halfway along 200 units of elbow is the corner.
    expect(poseOf({ at: 'mid' }, edgeDep(elbow))).toEqual(box(90, -4));
  });

  it('takes a parameter as readily as a name', () => {
    expect(poseOf({ at: 0.25 }, edgeDep(elbow))).toEqual(box(40, -4));
  });

  it('sits on the ends at start and end', () => {
    expect(poseOf({ at: 'start' }, edgeDep(elbow))).toEqual(box(-10, -4));
    expect(poseOf({ at: 'end' }, edgeDep(elbow))).toEqual(box(90, 96));
  });

  it('sits on the route where it passes nearest its place, beside the run there', () => {
    expect(poseOf({ at: { near: { x: 110, y: 50 } } }, edgeDep(elbow))).toEqual(box(90, 46));
    // Running down, left of travel is +x: its near side 10 right of the run.
    expect(poseOf({ at: { near: { x: 110, y: 50 } }, offset: 10 }, edgeDep(elbow))).toEqual(box(110, 46));
    expect(poseOf({ at: { near: { x: 40, y: -5 } } }, edgeDep(elbow))).toEqual(box(30, -4));
  });

  it('offsets to the left of travel, which is above a rightward edge', () => {
    // Its bottom side, not its center, 10 above the line.
    expect(poseOf({ at: 'mid', offset: 10 }, edgeDep(line))).toEqual(box(40, -18));
  });

  it('offsets the other way for a negative offset', () => {
    expect(poseOf({ at: 'mid', offset: -10 }, edgeDep(line))).toEqual(box(40, 10));
  });

  it('clears its own width beside an edge running down', () => {
    // Down's left is +x, so its left side lands 10 right of the line at x = 0.
    const down = polylineFromPoints([{ x: 0, y: 0 }, { x: 0, y: 100 }]);
    expect(poseOf({ at: 'mid', offset: 10 }, edgeDep(down))).toEqual(box(10, 46));
  });

  it('keeps its own size wherever it lands', () => {
    const pose = poseOf({ at: 'mid' }, edgeDep(line), box(0, 0, 60, 12));
    expect(pose).toMatchObject({ width: 60, height: 12 });
  });

  it('derives nothing when its dependency has no path', () => {
    expect(poseOf({ at: 'mid' }, edgeDep(null))).toBeNull();
  });

  it('derives nothing when its dependency is gone', () => {
    expect(poseOf({ at: 'mid' }, undefined)).toBeNull();
  });

  it('derives nothing for a node carrying no label trait', () => {
    expect(derive({ pose: box(0, 0), data: {} } as never, [edgeDep(line)])).toBeNull();
  });
});

describe('registry', () => {
  it('registers the label derivation so an authored label round-trips through toJSON', () => {
    const scene = createScene<object, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withDiagramRegistry<RectPose>(),
    });
    const edge = scene.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: {} });
    const label = scene.add({
      kind: 'leaf', layer: 'main', pose: box(0, 0),
      data: { diagram: { label: { at: 'mid' } } },
      dependsOn: [edge],
      derivePose: LABEL_DERIVE_POSE as never,
    });
    const node = scene.toJSON().nodes.find((n) => n.id === (label as string))!;
    expect(node.derivePoseKey).toBe(DIAGRAM_LABEL);
  });
});

describe('a label layout stationed', () => {
  // `a → c` passes `b`, so layout gives it waypoints and its label a rank of
  // its own between them.
  const data: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c', label: 'past' }],
  };
  const edge = edgeIdOf(data.edges[2]!);

  it('stays on its stretch when the route gains a bend before it', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: diagramScene(data) as never,
      registry: withDiagramRegistry(),
    });
    const pose = () => effectivePose(scene as never, scene.get(`${edge}/label` as never)! as never);
    const before = pose();
    const own = scene.get(edge as never)!.data as { diagram: { waypoints: Vec2[] } };
    const [first] = own.diagram.waypoints;
    const bent = [{ x: first!.x - 40, y: first!.y - 10 }, ...own.diagram.waypoints];
    scene.update(edge as never, { data: { ...own, diagram: { ...own.diagram, waypoints: bent } } });
    expect(pose()).toEqual(before);
  });
});
