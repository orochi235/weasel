import { describe, it, expect } from 'vitest';
import { asNodeId, polylineFromPoints, type DerivedDep, type Path, type RectPose } from '@weasel-js/core';
import { DIAGRAM_LABEL, diagramLabelOf, labelDerivePose } from './label';

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

  it('offsets to the left of travel, which is above a rightward edge', () => {
    expect(poseOf({ at: 'mid', offset: 10 }, edgeDep(line))).toEqual(box(40, -14));
  });

  it('offsets the other way for a negative offset', () => {
    expect(poseOf({ at: 'mid', offset: -10 }, edgeDep(line))).toEqual(box(40, 6));
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
  it('names the derivation so an authored label round-trips', () => {
    expect(DIAGRAM_LABEL).toBe('diagram:label');
  });
});
