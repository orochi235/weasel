import { describe, it, expect } from 'vitest';
import {
  PathBuilder, boundsOfPath, reviveTypedArrays, typedArrayReplacer, worldCoords, type PolygonPath,
} from '@weasel-js/geom';
import { regionTakes, polygonRegion, rectRegion } from './regionHit';
import { pathPoseDescriptor } from './pathPoseDescriptor';
import { pathFromParts } from 'core/scene/derivedParts';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import type { SavedScene } from 'core/scene/types';

const FAR = 262_144;
const X = FAR + 0.3;

/** A unit square at `(FAR + 0.3, 1)`, measured from `(FAR, 0)`. */
const square = (dx = 0): PolygonPath => new PathBuilder().setOrigin(FAR, 0)
  .moveTo(X + dx, 1).lineTo(X + dx + 1, 1).lineTo(X + dx + 1, 2).lineTo(X + dx, 2).close().build();

describe('core readers of a path measured from an origin', () => {
  it('takes a silhouette pose into a marquee or lasso where its origin puts it', () => {
    const p = square();
    const b = boundsOfPath(p);
    const outline = () => p;
    const around = polygonRegion([{ x: X - 0.01, y: 0.9 }, { x: X + 1.1, y: 0.9 }, { x: X + 0.5, y: 2.5 }])!;
    expect(regionTakes(around, 'intersect', p, b, outline)).toBe(true);
    const box = rectRegion({ x: X - 0.01, y: 0.9, width: 1.02, height: 1.2 });
    expect(regionTakes(box, 'enclosed', p, b, outline)).toBe(true);
    const short = rectRegion({ x: X + 0.01, y: 0.9, width: 1.02, height: 1.2 });
    expect(regionTakes(short, 'enclosed', p, b, outline)).toBe(false);
  });

  it('interpolates and animates a polygon pose through its own space', () => {
    const a = square(), b = square(1);
    const mid = pathPoseDescriptor.lerp!(a, b, 0.5) as PolygonPath;
    expect(worldCoords(mid)[0]).toBeCloseTo(X + 0.5, 6);
    const axes = pathPoseDescriptor.axes!(a)!;
    const values = axes.to(b);
    expect(values[0]).toBeCloseTo(X + 1, 6);
    const back = axes.from(values) as PolygonPath;
    expect(worldCoords(back)[0]).toBeCloseTo(X + 1, 6);
  });

  it('joins parts with different origins into one measured from the first', () => {
    const other = new PathBuilder().setOrigin(FAR + 100, 0)
      .moveTo(X, 5).lineTo(X + 1, 5).lineTo(X + 1, 6).close().build();
    const whole = pathFromParts([{ path: square() }, { path: other }]) as PolygonPath;
    expect(whole.origin).toEqual({ x: FAR, y: 0 });
    // Re-measured from the first part's origin, 100 units away: float32 there is good to 2^-17.
    expect(worldCoords(whole)[8]).toBeCloseTo(X, 4);
    expect(worldCoords(whole)[9]).toBe(5);
  });

  it('saves and loads a path pose with its origin', () => {
    const scene = createScene<unknown, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', layer: 'main', pose: square(), data: null });
    const text = JSON.stringify(scene.toJSON(), typedArrayReplacer);
    const saved = reviveTypedArrays(JSON.parse(text)) as SavedScene<unknown, 'main', PolygonPath>;
    const loaded = sceneFromJSON(saved);
    const node = loaded.get(id)!;
    expect(node.pose.origin).toEqual({ x: FAR, y: 0 });
    expect(worldCoords(node.pose)[0]).toBeCloseTo(X, 6);
  });
});
