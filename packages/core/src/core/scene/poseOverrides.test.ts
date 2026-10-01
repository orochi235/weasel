import { describe, expect, it, vi } from 'vitest';
import { createPoseOverrides } from './poseOverrides';
import { nodeMemo } from './nodeMemo';
import { asNodeId } from './types';

interface Pose { x: number; y: number }

const ID = asNodeId('n1');

function setup() {
  const node = { data: { label: 'n1' } };
  const overrides = createPoseOverrides<Pose>((id) => (id === ID ? node : undefined));
  return { node, overrides };
}

describe('createPoseOverrides', () => {
  it('stores the caller\'s entry by reference so it can be mutated in place', () => {
    const { overrides } = setup();
    const entry = { pose: { x: 1, y: 2 } };
    overrides.set(ID, entry);
    expect(overrides.get(ID)).toBe(entry);
    entry.pose.x = 99;
    expect(overrides.get(ID)!.pose!.x).toBe(99);
  });

  it('reports membership and ids', () => {
    const { overrides } = setup();
    expect(overrides.has(ID)).toBe(false);
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(overrides.has(ID)).toBe(true);
    expect(overrides.ids()).toEqual([ID]);
  });

  it('clear removes one entry; clearAll removes all', () => {
    const { overrides } = setup();
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clear(ID);
    expect(overrides.get(ID)).toBeUndefined();

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clearAll();
    expect(overrides.ids()).toEqual([]);
  });

  it('notifies subscribers on set, commit, clear and clearAll — and stops after unsubscribe', () => {
    const { overrides } = setup();
    const seen = vi.fn();
    const unsubscribe = overrides.subscribe(seen);

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(seen).toHaveBeenCalledTimes(1);
    overrides.commit();
    expect(seen).toHaveBeenCalledTimes(2);
    overrides.clear(ID);
    expect(seen).toHaveBeenCalledTimes(3);

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clearAll();
    expect(seen).toHaveBeenCalledTimes(5);

    unsubscribe();
    overrides.set(ID, { pose: { x: 1, y: 1 } });
    expect(seen).toHaveBeenCalledTimes(5);
  });

  it('does not notify when clear / clearAll change nothing', () => {
    const { overrides } = setup();
    const seen = vi.fn();
    overrides.subscribe(seen);
    overrides.clear(ID);
    overrides.clearAll();
    expect(seen).not.toHaveBeenCalled();
  });

  it('bumps the generation on every write', () => {
    const { overrides } = setup();
    const start = overrides.getGeneration();
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.commit();
    expect(overrides.getGeneration()).toBe(start + 2);
  });

  it('commit drops the pose-keyed memo slots of every overridden node', () => {
    const { node, overrides } = setup();
    const pose = { x: 0, y: 0 };
    let calls = 0;
    const derive = () => { calls++; return calls; };

    overrides.set(ID, { pose });
    expect(nodeMemo(node, 'paint', pose, derive)).toBe(1);
    expect(nodeMemo(node, 'paint', pose, derive)).toBe(1);

    pose.x = 50;            // mutated in place — same reference
    overrides.commit();

    expect(nodeMemo(node, 'paint', pose, derive)).toBe(2);
  });

  describe('read', () => {
    it('is undefined for a node with no entry, and after its entry is cleared', () => {
      const { overrides } = setup();
      expect(overrides.read(ID)).toBeUndefined();
      overrides.set(ID, { pose: { x: 1, y: 2 } });
      overrides.clear(ID);
      expect(overrides.read(ID)).toBeUndefined();
    });

    it('answers the entry\'s pose by reference and its alpha', () => {
      const { overrides } = setup();
      const pose = { x: 1, y: 2 };
      overrides.set(ID, { pose, alpha: 0.25 });
      expect(overrides.read(ID)!.pose).toBe(pose);
      expect(overrides.read(ID)!.alpha).toBe(0.25);
    });

    it('reads alpha as 1 for an entry that sets none', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: { x: 0, y: 0 } });
      expect(overrides.read(ID)!.alpha).toBe(1);
    });

    it('reads an entry with no pose as no pose', () => {
      const { overrides } = setup();
      overrides.set(ID, { alpha: 0.5 });
      expect(overrides.read(ID)!.pose).toBeUndefined();
    });

    it('sees an in-place mutation once it is committed', () => {
      const { overrides } = setup();
      const entry: { pose: Pose; alpha?: number } = { pose: { x: 0, y: 0 } };
      overrides.set(ID, entry);
      expect(overrides.read(ID)!.alpha).toBe(1);
      entry.alpha = 0.5;
      overrides.commit();
      expect(overrides.read(ID)!.alpha).toBe(0.5);
    });

    it('sees a replacement entry set in the same frame as a read', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: { x: 0, y: 0 }, alpha: 0.5 });
      expect(overrides.read(ID)!.alpha).toBe(0.5);
      const pose = { x: 7, y: 7 };
      overrides.set(ID, { pose, alpha: 0.75 });
      expect(overrides.read(ID)!.pose).toBe(pose);
      expect(overrides.read(ID)!.alpha).toBe(0.75);
    });

    it('reuses one object per node across frames', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: { x: 0, y: 0 } });
      const first = overrides.read(ID);
      overrides.commit();
      expect(overrides.read(ID)).toBe(first);
    });
  });

  it('survives an id that no longer resolves to a node', () => {
    const overrides = createPoseOverrides<Pose>(() => undefined);
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(() => overrides.commit()).not.toThrow();
  });
});
