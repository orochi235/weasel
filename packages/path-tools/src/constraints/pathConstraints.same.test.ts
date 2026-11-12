import { expect, it } from 'vitest';
import { polygonFromPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import { asNodeId, createScene, IDENTITY_POSE_COMPOSITION } from '@weasel-js/core';
import { constrainNodeEdit } from './pathConstraints';

it('hands back the stored list when the edit leaves it as it was, whatever order its keys were written in', () => {
  // As a document read from a file holds it: the same constraint, keys in another order than the solver writes.
  const stored = [{ anchor: 0, kind: 'fixed' } as PathConstraint];
  const scene = createScene<{ constraints: PathConstraint[] }, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const id = asNodeId('box');
  const rect = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
  scene.add({ id, kind: 'mark', layer: 'main', pose: polygonFromPoints(rect), data: { constraints: stored } });
  const moved = polygonFromPoints([rect[0]!, { x: 120, y: 0 }, rect[2]!, rect[3]!]) as PolygonPath;
  const edit = constrainNodeEdit(scene.get(id) as never, moved);
  expect(edit?.constraints).toBe(stored);
});
