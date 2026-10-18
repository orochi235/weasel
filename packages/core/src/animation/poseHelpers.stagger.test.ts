import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '@weasel-js/animator/react';
import { staggerSpringPose } from './poseHelpers';

interface Pose { x: number }

function setup(ids: string[]) {
  const poses = new Map<string, Pose>(ids.map((id) => [id, { x: 0 }]));
  const adapter = {
    getPose: (id: string) => poses.get(id)!,
    setPose: vi.fn((id: string, pose: Pose) => { poses.set(id, pose); }),
  };
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  const { result } = renderHook(() => useAnimator({
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
  }));
  const frame = (t: number) => {
    clock = t;
    const due = cbs.splice(0);
    act(() => { for (const cb of due) cb(t); });
  };
  const geometry = { lerp: (a: Pose, b: Pose, t: number) => ({ x: a.x + (b.x - a.x) * t }) } as never;
  return { adapter, animator: () => result.current, frame, geometry };
}

describe('staggerSpringPose', () => {
  it('springs each item under its own pose key, the delay apart', () => {
    const { adapter, animator, frame, geometry } = setup(['a', 'b']);
    act(() => {
      staggerSpringPose(animator(), adapter, {
        items: ['a', { id: 'b' }], delay: 100, to: (_item, i) => ({ x: 10 * (i + 1) }), geometry,
      });
    });
    expect(animator().isActive('pose:a')).toBe(true);
    expect(animator().isActive('pose:b')).toBe(false);
    frame(0);
    frame(100);
    expect(animator().isActive('pose:b')).toBe(true);
  });

  it('names the stagger by its label and reaches it by its cancel key', () => {
    const { adapter, animator, geometry } = setup(['a']);
    const kinds: string[] = [];
    animator().watch((e) => { kinds.push(`${e.type}:${e.animation.kind}:${e.animation.label ?? ''}`); });
    act(() => {
      staggerSpringPose(animator(), adapter, {
        items: ['a'], delay: 0, to: () => ({ x: 1 }), geometry, label: 'sp', cancelKey: 'fan',
      });
    });
    expect(kinds).toContain('start:stagger:sp');
    expect(animator().isActive('fan')).toBe(true);
  });

  it('refuses an item that names no node', () => {
    const { adapter, animator, geometry } = setup([]);
    expect(() => staggerSpringPose(animator(), adapter, {
      items: [{ name: 'a' }], delay: 0, to: () => ({ x: 1 }), geometry,
    })).toThrow(/string `id` field/);
  });
});
