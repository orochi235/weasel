import { describe, expect, it } from 'vitest';
import { PathBuilder, polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { constraintsForAnchors } from './anchorConstraints';

const SQUARE = polygonFromPoints([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }, { x: 0, y: 40 }]) as PolygonPath;

describe('constraintsForAnchors', () => {
  it('pins each anchor and chains pairs in selection order', () => {
    expect(constraintsForAnchors('fixed', [2, 0], SQUARE)).toEqual([
      { kind: 'fixed', anchor: 2 }, { kind: 'fixed', anchor: 0 },
    ]);
    expect(constraintsForAnchors('vertical', [1, 2, 3], SQUARE)).toEqual([
      { kind: 'vertical', segment: [1, 2] }, { kind: 'vertical', segment: [2, 3] },
    ]);
    expect(constraintsForAnchors('coincident', [0, 3], SQUARE)).toEqual([{ kind: 'coincident', anchors: [0, 3] }]);
  });

  it('holds the length a pair has now unless one is given', () => {
    expect(constraintsForAnchors('length', [0, 2], SQUARE)).toEqual([{ kind: 'length', segment: [0, 2], length: 50 }]);
    expect(constraintsForAnchors('length', [0, 2], SQUARE, 12)).toEqual([{ kind: 'length', segment: [0, 2], length: 12 }]);
  });

  it('makes two segments from three anchors or four, and nothing from two', () => {
    expect(constraintsForAnchors('equalLength', [0, 1, 2, 3], SQUARE)).toEqual([
      { kind: 'equalLength', segments: [[0, 1], [2, 3]] },
    ]);
    expect(constraintsForAnchors('parallel', [0, 1], SQUARE)).toEqual([]);
  });

  it('asks a tangent only of anchors with both handles', () => {
    const wave = new PathBuilder().moveTo(0, 0).curveTo(20, -20, 60, -20, 80, 0).curveTo(100, 20, 140, 20, 160, 0)
      .build() as PolygonPath;
    expect(constraintsForAnchors('tangent', [0, 1, 2], wave)).toEqual([{ kind: 'tangent', anchor: 1 }]);
  });
});
