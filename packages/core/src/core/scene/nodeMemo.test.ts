/**
 * `nodeMemo`'s contract, which is entirely about when it *stops* answering.
 *
 * The memo rests on one fact about the scene: it mutates node objects in place
 * but *replaces* `pose` and `data` with new references (the `kit:setPose` /
 * `kit:setData` ops do `node.pose = p.to` / `node.data = p.to`). So the node
 * object is a stable identity and those two references are an exact freshness
 * signal. Everything below pins a way that could go wrong.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { nodeMemo, bumpNodeMemoGeneration } from './nodeMemo';

afterEach(() => {
  // Leave no cached entry visible to the next test.
  bumpNodeMemoGeneration();
});

/** A stand-in for a scene node: identity stable, `data` swapped wholesale. */
function makeNode(data: unknown): { data: unknown } {
  return { data };
}

const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('nodeMemo', () => {
  it('derives once for an unchanged node, pose and data', () => {
    const node = makeNode({ a: 1 });
    const derive = vi.fn(() => ({ built: true }));
    const first = nodeMemo(node, 'slot', POSE, derive);
    const second = nodeMemo(node, 'slot', POSE, derive);
    expect(derive).toHaveBeenCalledTimes(1);
    // Same object, not merely an equal one — the point is the second call
    // allocated nothing.
    expect(second).toBe(first);
  });

  it('re-derives when the pose reference changes', () => {
    const node = makeNode({ a: 1 });
    const derive = vi.fn(() => ({}));
    nodeMemo(node, 'slot', POSE, derive);
    nodeMemo(node, 'slot', { ...POSE }, derive);
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('re-derives when the node\'s data reference changes', () => {
    const node = makeNode({ a: 1 });
    const derive = vi.fn(() => node.data);
    expect(nodeMemo(node, 'slot', POSE, derive)).toEqual({ a: 1 });
    node.data = { a: 2 };
    expect(nodeMemo(node, 'slot', POSE, derive)).toEqual({ a: 2 });
    expect(derive).toHaveBeenCalledTimes(2);
  });

  it('keeps slots independent', () => {
    // The whole reason `slot` exists: a node has several derived values that
    // invalidate on the same signals but must not overwrite each other.
    const node = makeNode({ a: 1 });
    const painter = vi.fn(() => 'painter');
    const silhouette = vi.fn(() => 'silhouette');
    expect(nodeMemo(node, 'painter', POSE, painter)).toBe('painter');
    expect(nodeMemo(node, 'silhouette', POSE, silhouette)).toBe('silhouette');
    expect(nodeMemo(node, 'painter', POSE, painter)).toBe('painter');
    expect(painter).toHaveBeenCalledTimes(1);
    expect(silhouette).toHaveBeenCalledTimes(1);
  });

  it('keeps entries per node', () => {
    const a = makeNode({ a: 1 });
    const b = makeNode({ a: 1 });
    expect(nodeMemo(a, 'slot', POSE, () => 'a')).toBe('a');
    expect(nodeMemo(b, 'slot', POSE, () => 'b')).toBe('b');
    expect(nodeMemo(a, 'slot', POSE, () => 'nope')).toBe('a');
  });

  it('caches a nullish derived value rather than re-deriving it', () => {
    // "No silhouette" is a real answer, and the expensive part is discovering
    // it. A memo that treats `null` as "not computed yet" caches nothing for
    // exactly the painters that return null.
    const node = makeNode({ a: 1 });
    const derive = vi.fn(() => null);
    expect(nodeMemo(node, 'slot', POSE, derive)).toBeNull();
    expect(nodeMemo(node, 'slot', POSE, derive)).toBeNull();
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('does not let a preview pose poison the node\'s own', () => {
    // Mid-drag a caller passes a ghost pose that isn't `node.pose`. That must
    // miss and recompute, and must not become the answer for the real pose.
    const node = makeNode({ a: 1 });
    const derive = (pose: { x: number }) => () => pose.x;
    const ghost = { x: 900, y: 900, width: 10, height: 10 };
    expect(nodeMemo(node, 'slot', POSE, derive(POSE))).toBe(0);
    expect(nodeMemo(node, 'slot', ghost, derive(ghost))).toBe(900);
    expect(nodeMemo(node, 'slot', POSE, derive(POSE))).toBe(0);
  });

  it('drops every slot on every node when the generation is bumped', () => {
    // The failure mode a (pose, data) key cannot see: a registry mutating
    // underneath a cached entry, changing what `derive` would return.
    const a = makeNode({ a: 1 });
    const b = makeNode({ b: 1 });
    let answer = 'before';
    const derive = () => answer;
    expect(nodeMemo(a, 'one', POSE, derive)).toBe('before');
    expect(nodeMemo(b, 'two', POSE, derive)).toBe('before');
    answer = 'after';
    expect(nodeMemo(a, 'one', POSE, derive)).toBe('before');

    bumpNodeMemoGeneration();
    expect(nodeMemo(a, 'one', POSE, derive)).toBe('after');
    expect(nodeMemo(b, 'two', POSE, derive)).toBe('after');
  });

  it('memoizes against a node with no data at all', () => {
    // Not every memoizable object is a full scene node — the key must not
    // require `data` to exist.
    const node = {} as { data?: unknown };
    const derive = vi.fn(() => 'x');
    expect(nodeMemo(node, 'slot', POSE, derive)).toBe('x');
    expect(nodeMemo(node, 'slot', POSE, derive)).toBe('x');
    expect(derive).toHaveBeenCalledTimes(1);
  });
});
