/**
 * Several writers overriding one node: each entry is a ply, a field shows
 * what the most recently claimed ply giving it says, releasing a ply shows
 * what lies under it, and a ply's path is carried with a pose laid over it.
 */
import { describe, expect, it, vi } from 'vitest';
import { boundsOfPath, polygonFromPoints, type Path } from '@weasel-js/geom';
import { createPoseOverrides } from './poseOverrides';
import { foldPlies } from './posePlies';
import { nodeAsShown } from './nodeAsShown';
import { asNodeId, type NodeId, type PoseOverride } from './types';

interface Pose { x: number; y: number; width?: number; height?: number }
type Data = Record<string, unknown>;

const ID = asNodeId('n1');

function setup() {
  const node = { id: ID, data: { label: 'n1' } as Data };
  const overrides = createPoseOverrides<Pose, Data>((id) => (id === ID ? node : undefined));
  return { node, overrides };
}

const at = (x: number): Pose => ({ x, y: 0 });
const box = (x: number, y: number, width = 10, height = 10): Pose => ({ x, y, width, height });
const tag = (name: string) => (stored: Data): Data => ({ ...stored, seen: [...((stored.seen as string[] | undefined) ?? []), name] });

describe('override plies', () => {
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

  describe('three deep', () => {
    function three() {
      const s = setup();
      const a: PoseOverride<Pose, Data> = { pose: at(1), alpha: 0.5, data: tag('a') };
      const b: PoseOverride<Pose, Data> = { alpha: 0.5, data: tag('b') };
      const c: PoseOverride<Pose, Data> = { pose: at(3), data: tag('c') };
      for (const e of [a, b, c]) s.overrides.set(ID, e);
      return { ...s, a, b, c };
    }

    it('folds every ply in the order each was set', () => {
      const { node, overrides, c } = three();
      expect(overrides.read(ID)!.pose).toBe(c.pose);
      expect(overrides.read(ID)!.alpha).toBe(0.25);
      expect(nodeAsShown(overrides, node).data.seen).toEqual(['a', 'b', 'c']);
    });

    it('closes up around a middle ply released', () => {
      const { node, overrides, a, b, c } = three();
      overrides.clear(ID, b);
      expect(overrides.read(ID)!.pose).toBe(c.pose);
      expect(overrides.read(ID)!.alpha).toBe(0.5);
      expect(nodeAsShown(overrides, node).data.seen).toEqual(['a', 'c']);
      overrides.clear(ID, c);
      expect(overrides.read(ID)!.pose).toBe(a.pose);
      expect(nodeAsShown(overrides, node).data.seen).toEqual(['a']);
    });

    it('puts a released ply set again on top', () => {
      const { node, overrides, a } = three();
      overrides.clear(ID, a);
      overrides.set(ID, a);
      expect(overrides.read(ID)!.pose).toBe(a.pose);
      expect(nodeAsShown(overrides, node).data.seen).toEqual(['b', 'c', 'a']);
    });
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

  describe('a path and the pose it is drawn at', () => {
    const BENT: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }]);

    it('carries a ply\'s path with a pose laid over its own', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: box(0, 0, 20, 10), path: BENT });
      overrides.set(ID, { pose: box(30, 5, 20, 10) });
      expect(boundsOfPath(overrides.read(ID)!.path!)).toMatchObject({ x: 30, y: 5, width: 20, height: 10 });
    });

    it('answers the same carried path while neither pose changes', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: box(0, 0, 20, 10), path: BENT });
      overrides.set(ID, { pose: box(30, 5, 20, 10) });
      const first = overrides.read(ID)!.path;
      overrides.commit();
      expect(overrides.read(ID)!.path).toBe(first);
    });

    it('leaves a path given with no pose where it is', () => {
      const { overrides } = setup();
      overrides.set(ID, { path: BENT });
      overrides.set(ID, { pose: box(30, 5, 20, 10) });
      expect(overrides.read(ID)!.path).toBe(BENT);
    });

    it('shows the path as given once the pose over it is released', () => {
      const { overrides } = setup();
      overrides.set(ID, { pose: box(0, 0, 20, 10), path: BENT });
      const move = { pose: box(30, 5, 20, 10) };
      overrides.set(ID, move);
      overrides.clear(ID, move);
      expect(overrides.read(ID)!.path).toBe(BENT);
    });
  });

  describe('clearing the node', () => {
    it('drops every writer\'s entry, and each comes back where it stood however they reinstall', () => {
      const { node, overrides } = setup();
      const a: PoseOverride<Pose, Data> = { pose: at(1), data: tag('a') };
      const b: PoseOverride<Pose, Data> = { data: tag('b') };
      const c: PoseOverride<Pose, Data> = { pose: at(3), data: tag('c') };
      for (const e of [a, b, c]) overrides.set(ID, e);
      overrides.clear(ID);
      expect(overrides.read(ID)).toBeUndefined();
      expect(overrides.has(ID, a)).toBe(false);
      for (const e of [c, a, b]) overrides.set(ID, e);
      expect(overrides.read(ID)!.pose).toBe(c.pose);
      expect(nodeAsShown(overrides, node).data.seen).toEqual(['a', 'b', 'c']);
    });

    it('puts every writer back where it stood after clearAll too', () => {
      const { overrides } = setup();
      const lower = { pose: at(1) };
      const upper = { pose: at(2) };
      overrides.set(ID, lower);
      overrides.set(ID, upper);
      overrides.clearAll();
      expect(overrides.ids()).toEqual([]);
      overrides.set(ID, upper);
      overrides.set(ID, lower);
      expect(overrides.read(ID)!.pose).toBe(upper.pose);
    });
  });
});

describe('foldPlies', () => {
  /** The node's plies, counting how often the fold asks for them. */
  function counted(plies: PoseOverride<Pose, Data>[]) {
    const map = new Map<NodeId, PoseOverride<Pose, Data>[]>([[ID, plies]]);
    let asked = 0;
    const source = { get: (id: NodeId) => { asked++; return map.get(id); } } as unknown as ReadonlyMap<NodeId, readonly PoseOverride<Pose, Data>[]>;
    return { source, asked: () => asked };
  }

  it('asks for no more plies than the deepest stack holds once stacks shrink', () => {
    const plies: PoseOverride<Pose, Data>[] = [{ pose: at(1) }, { pose: at(2) }, { pose: at(3) }];
    const { source, asked } = counted(plies);
    const fold = foldPlies(source);
    fold.publish(3);
    const out: PoseOverride<Pose, Data> = {};
    fold.probe(ID, out);
    expect(out.pose).toBe(plies[2]!.pose);
    const deep = asked();
    plies.splice(1, 2);
    fold.publish(1);
    fold.probe(ID, out);
    expect(asked() - deep).toBe(1);
    expect(out.pose).toBe(plies[0]!.pose);
  });
});
