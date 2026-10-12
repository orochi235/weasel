import { describe, expect, it } from 'vitest';
import { polygonFromPoints } from '@weasel-js/geom';
import { autoSkin } from './autoSkin';
import { IDENTITY_JOINT, type Skeleton } from './types';
import type { Skin } from './skin';

const j = (name: string, parent: string | null, x = 0, y = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y },
});

const ARM: Skeleton = { joints: [j('shoulder', null), j('elbow', 'shoulder', 100), j('wrist', 'elbow', 100)] };

const w = (skin: Skin, joint: string, point: number) => skin[joint]?.[point] ?? 0;

describe('autoSkin', () => {
  const outline = polygonFromPoints([
    { x: 10, y: -10 }, { x: 100, y: -10 }, { x: 150, y: -10 }, { x: 150, y: 0 },
  ]);
  const skin = autoSkin(outline, ARM);

  it('weighs a point toward the bone it is nearest', () => {
    expect(w(skin, 'shoulder', 0)).toBeGreaterThan(0.99);
    expect(w(skin, 'elbow', 2)).toBeGreaterThan(0.99);
  });

  it('splits a point evenly between two bones it is equally far from', () => {
    expect(w(skin, 'shoulder', 1)).toBeCloseTo(0.5, 6);
    expect(w(skin, 'elbow', 1)).toBeCloseTo(0.5, 6);
  });

  it('gives a point on a bone wholly to that bone', () => {
    expect(w(skin, 'elbow', 3)).toBe(1);
    expect(w(skin, 'shoulder', 3)).toBe(0);
    expect(w(skin, 'wrist', 3)).toBe(0);
  });

  it('makes every weight array as long as the path has points, each point summing to 1', () => {
    for (const weights of Object.values(skin)) expect(weights).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(w(skin, 'shoulder', i) + w(skin, 'elbow', i) + w(skin, 'wrist', i)).toBeCloseTo(1, 6);
    }
  });

  it('keeps at most `max` joints on a point', () => {
    expect(['shoulder', 'elbow'].filter((n) => w(skin, n, 1) > 0)).toHaveLength(2);
    const one = autoSkin(outline, ARM, { max: 1 });
    for (let i = 0; i < 4; i++) {
      expect(['shoulder', 'elbow', 'wrist'].filter((n) => w(one, n, i) > 0)).toHaveLength(1);
    }
  });

  it('leaves out a joint that weighs no point', () => {
    expect(Object.keys(autoSkin(outline, ARM, { max: 1 })).sort()).toEqual(['elbow', 'shoulder']);
  });

  it('gives a joint with no child no weight: it is where its parent bone ends', () => {
    const tip = autoSkin(polygonFromPoints([{ x: 205, y: 3 }]), ARM);
    expect(tip.wrist).toBeUndefined();
    expect(w(tip, 'elbow', 0)).toBeGreaterThan(0.99);
  });

  it('gives a skeleton of one joint every point', () => {
    expect(autoSkin(outline, { joints: [j('root', null, 5, 5)] })).toEqual({ root: [1, 1, 1, 1] });
  });

  it('measures bones where the hierarchy puts them', () => {
    const bent: Skeleton = {
      joints: [
        { name: 'a', parent: null, bind: { ...IDENTITY_JOINT, rotation: Math.PI / 2 } },
        j('b', 'a', 100), j('c', 'b', 100),
      ],
    };
    // Bone a runs from the origin down to (0, 100); bone b on to (0, 200).
    const s = autoSkin(polygonFromPoints([{ x: 10, y: 20 }, { x: 10, y: 180 }]), bent);
    expect(w(s, 'a', 0)).toBeGreaterThan(0.99);
    expect(w(s, 'b', 1)).toBeGreaterThan(0.99);
  });

  it('sharpens the split as `power` rises', () => {
    const near = polygonFromPoints([{ x: 90, y: -10 }]);
    expect(w(autoSkin(near, ARM, { power: 8 }), 'shoulder', 0))
      .toBeGreaterThan(w(autoSkin(near, ARM, { power: 2 }), 'shoulder', 0));
  });
});
