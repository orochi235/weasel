/**
 * Several writers overriding one node: each entry is a layer, a field shows
 * what the most recently set layer writing it says, and releasing a layer
 * shows what lies under it.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPoseOverrides } from './poseOverrides';
import { nodeAsShown } from './nodeAsShown';
import { asNodeId, type PoseOverride } from './types';

interface Pose { x: number; y: number }
type Data = Record<string, unknown>;

const ID = asNodeId('n1');

function setup() {
  const node = { id: ID, data: { label: 'n1' } as Data };
  const overrides = createPoseOverrides<Pose, Data>((id) => (id === ID ? node : undefined));
  return { node, overrides };
}

const at = (x: number): Pose => ({ x, y: 0 });

describe('layered overrides', () => {
  it('shows two writers on different fields of one node together', () => {
    const { overrides } = setup();
    const pose = at(5);
    overrides.set(ID, { pose });
    overrides.set(ID, { alpha: 0.5 });
    expect(overrides.read(ID)!.pose).toBe(pose);
    expect(overrides.read(ID)!.alpha).toBe(0.5);
  });

  it('shows the writer that set its entry last where two write the same field, and the other once it is released', () => {
    const { overrides } = setup();
    const lower = { pose: at(1) };
    const upper = { pose: at(2) };
    overrides.set(ID, lower);
    overrides.set(ID, upper);
    expect(overrides.read(ID)!.pose).toBe(upper.pose);
    overrides.clear(ID, upper);
    expect(overrides.read(ID)!.pose).toBe(lower.pose);
    overrides.clear(ID, lower);
    expect(overrides.read(ID)).toBeUndefined();
    expect(overrides.has(ID)).toBe(false);
  });

  it('keeps the upper writer when the lower one is released first', () => {
    const { overrides } = setup();
    const lower = { pose: at(1), alpha: 0.5 };
    const upper = { pose: at(2) };
    overrides.set(ID, lower);
    overrides.set(ID, upper);
    overrides.clear(ID, lower);
    expect(overrides.read(ID)!.pose).toBe(upper.pose);
    expect(overrides.read(ID)!.alpha).toBe(1);
    expect(overrides.ids()).toEqual([ID]);
  });

  it('brings an installed entry set again to the top', () => {
    const { overrides } = setup();
    const first = { pose: at(1) };
    const second = { pose: at(2) };
    overrides.set(ID, first);
    overrides.set(ID, second);
    overrides.set(ID, first);
    expect(overrides.read(ID)!.pose).toBe(first.pose);
    expect(overrides.get(ID)).toBe(first);
    overrides.clear(ID, first);
    expect(overrides.read(ID)!.pose).toBe(second.pose);
  });

  it('multiplies every writer\'s alpha', () => {
    const { overrides } = setup();
    overrides.set(ID, { alpha: 0.5 });
    overrides.set(ID, { alpha: 0.5 });
    expect(overrides.read(ID)!.alpha).toBe(0.25);
  });

  it('answers the top entry from get, and whether a given entry is installed from has', () => {
    const { overrides } = setup();
    const lower = { pose: at(1) };
    const upper = { pose: at(2) };
    overrides.set(ID, lower);
    overrides.set(ID, upper);
    expect(overrides.get(ID)).toBe(upper);
    expect(overrides.has(ID, lower)).toBe(true);
    expect(overrides.has(ID, upper)).toBe(true);
    expect(overrides.has(ID, { pose: at(1) })).toBe(false);
    expect(overrides.ids()).toEqual([ID]);
  });

  it('changes nothing, and tells no one, clearing an entry that is not installed', () => {
    const { overrides } = setup();
    const entry = { pose: at(1) };
    overrides.set(ID, entry);
    const heard = vi.fn();
    overrides.subscribe(heard);
    const generation = overrides.getGeneration();
    overrides.clear(ID, { pose: at(1) });
    expect(heard).not.toHaveBeenCalled();
    expect(overrides.getGeneration()).toBe(generation);
    expect(overrides.get(ID)).toBe(entry);
  });

  describe('data', () => {
    const addA = (stored: Data): Data => ({ ...stored, a: 1 });
    const addB = (stored: Data): Data => ({ ...stored, b: 2, label: `${String(stored.label)}!` });

    it('runs the later writer on what the earlier one shows', () => {
      const { node, overrides } = setup();
      overrides.set(ID, { data: addA });
      overrides.set(ID, { data: addB });
      expect(nodeAsShown(overrides, node).data).toEqual({ label: 'n1!', a: 1, b: 2 });
    });

    it('shows the same node, frame after frame, while neither writer changes its function', () => {
      const { node, overrides } = setup();
      overrides.set(ID, { data: addA });
      overrides.set(ID, { data: addB });
      const first = nodeAsShown(overrides, node);
      const fn = overrides.read(ID)!.data;
      overrides.commit();
      expect(overrides.read(ID)!.data).toBe(fn);
      expect(nodeAsShown(overrides, node)).toBe(first);
      expect(nodeAsShown(overrides, first)).toBe(first);
    });

    it('shows the lower writer\'s data alone once the upper one is released', () => {
      const { node, overrides } = setup();
      const upper: PoseOverride<Pose, Data> = { data: addB };
      overrides.set(ID, { data: addA });
      overrides.set(ID, upper);
      overrides.clear(ID, upper);
      expect(overrides.read(ID)!.data).toBe(addA);
      expect(nodeAsShown(overrides, node).data).toEqual({ label: 'n1', a: 1 });
    });
  });

  describe('clearing the node', () => {
    it('drops every writer\'s entry, and each can install its own again', () => {
      const { overrides } = setup();
      const lower = { pose: at(1), alpha: 0.5 };
      const upper = { pose: at(2) };
      overrides.set(ID, lower);
      overrides.set(ID, upper);
      overrides.clear(ID);
      expect(overrides.read(ID)).toBeUndefined();
      expect(overrides.has(ID, lower)).toBe(false);
      overrides.set(ID, lower);
      expect(overrides.read(ID)!.pose).toBe(lower.pose);
      expect(overrides.read(ID)!.alpha).toBe(0.5);
      overrides.set(ID, upper);
      expect(overrides.read(ID)!.pose).toBe(upper.pose);
    });

    it('drops every layer on clearAll', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: at(1) });
      overrides.set(ID, { pose: at(2) });
      overrides.clearAll();
      expect(overrides.ids()).toEqual([]);
      expect(overrides.read(ID)).toBeUndefined();
    });
  });
});
