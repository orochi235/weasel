import { describe, expect, it } from 'vitest';
import { resolveSkeleton } from './resolveSkeleton';
import { IDENTITY_JOINT, type Skeleton } from './types';
import { mat3 } from '../../renderer/math/mat3';

const j = (name: string, parent: string | null, x = 0, y = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y },
});

const apply = mat3.apply;

describe('resolveSkeleton', () => {
  it('returns the bind translation for a root joint at rest', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 20)] };
    const out = resolveSkeleton(skel, {});
    expect(apply(out.get('hip')!, 0, 0)).toEqual([10, 20]);
  });

  it('composes a child onto its parent', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 0), j('knee', 'hip', 5, 0)] };
    const out = resolveSkeleton(skel, {});
    expect(apply(out.get('knee')!, 0, 0)).toEqual([15, 0]);
  });

  it('applies a pose delta on top of bind', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { x: 5 } });
    expect(apply(out.get('hip')!, 0, 0)).toEqual([15, 0]);
  });

  it('propagates a parent rotation to a child position', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 0), j('knee', 'hip', 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { rotation: Math.PI / 2 } });
    const [x, y] = apply(out.get('knee')!, 0, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(10, 5);
  });

  it('multiplies a parent scale into a child offset', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 0), j('knee', 'hip', 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { scaleX: 2 } });
    expect(apply(out.get('knee')!, 0, 0)[0]).toBeCloseTo(20, 5);
  });

  it('applies a pose y delta on top of bind', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 10)] };
    const out = resolveSkeleton(skel, { hip: { y: 5 } });
    expect(apply(out.get('hip')!, 0, 0)).toEqual([0, 15]);
  });

  it('multiplies a parent scaleY into a child offset', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 0), j('knee', 'hip', 0, 10)] };
    const out = resolveSkeleton(skel, { hip: { scaleY: 3 } });
    expect(apply(out.get('knee')!, 0, 0)[1]).toBeCloseTo(30, 5);
  });

  it('lays a joint out in the renderer\'s column-major order', () => {
    const skel: Skeleton = { joints: [j('hip', null, 3, 4)] };
    const m = resolveSkeleton(skel, { hip: { rotation: Math.PI / 2, scaleX: 2, scaleY: 5 } }).get('hip')!;
    const expected = [0, 2, 0, -5, 0, 0, 3, 4, 1];
    expected.forEach((v, i) => expect(m[i]).toBeCloseTo(v, 5));
  });

  it('resolves every joint in the skeleton', () => {
    const skel: Skeleton = { joints: [j('a', null), j('b', 'a'), j('c', 'b')] };
    expect([...resolveSkeleton(skel, {}).keys()]).toEqual(['a', 'b', 'c']);
  });

  it('throws when a joint names a parent that has not been resolved yet', () => {
    const skel: Skeleton = { joints: [j('knee', 'hip'), j('hip', null)] };
    expect(() => resolveSkeleton(skel, {})).toThrow(/topological|parent/i);
  });
});
