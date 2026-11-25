import { describe, expect, it } from 'vitest';
import { snapBackOrDelete } from './snapBackOrDelete';
import type { GestureContext } from '@weasel-js/core/engine';
import { moveEndForTests as moveEnd } from '@weasel-js/core/test-seams';

interface Pose { x: number; y: number }

function ctx(originPose: Pose, currentPose: Pose, objectsById: Record<string, any> = {}): GestureContext<Pose> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', originPose]]),
    current: new Map([['a', currentPose]]),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: currentPose.x, worldY: currentPose.y, clientX: 0, clientY: 0 },
    view: null,
    adapter: {
      getNode: (id: string) => objectsById[id],
      getParent: () => null,
      getNodes: () => [],
    } as any,
    scratch: {},
  };
}

describe('snapBackOrDelete', () => {
  it('returns null (snap-back) when within radius and policy is snap-back', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'snap-back' });
    const c = ctx({ x: 5, y: 5 }, { x: 5.5, y: 5.2 });
    expect(b.onEnd!(c, moveEnd())).toBeNull();
  });

  it('returns null when within radius and policy is delete', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const c = ctx({ x: 5, y: 5 }, { x: 5.5, y: 5.2 });
    expect(b.onEnd!(c, moveEnd())).toBeNull();
  });

  it('returns [DeleteOp] when outside radius and policy is delete', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const obj = { id: 'a', x: 0, y: 0 };
    const c = ctx({ x: 5, y: 5 }, { x: 50, y: 50 }, { a: obj });
    const ops = b.onEnd!(c, moveEnd());
    expect(Array.isArray(ops)).toBe(true);
    expect((ops as any[])[0].label).toMatch(/delete/i);
  });

  it('deletes every dragged node, topmost first so an undo restores paint order', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const nodes = [{ id: 'a' }, { id: 'x' }, { id: 'b' }, { id: 'c' }];
    const c = ctx({ x: 5, y: 5 }, { x: 50, y: 50 });
    c.draggedIds = ['a', 'c', 'b'];
    for (const id of ['b', 'c']) {
      c.origin.set(id, { x: 5, y: 5 });
      c.current.set(id, { x: 50, y: 50 });
    }
    c.adapter = { getNode: (id: string) => nodes.find((n) => n.id === id), getNodes: () => nodes, getParent: () => null } as any;
    b.onStart!(c);
    const ops = b.onEnd!(c, moveEnd()) as any[];
    expect(ops.map((op) => op.args.node.id)).toEqual(['c', 'b', 'a']);
  });

  it('aborts when outside radius and policy is snap-back', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'snap-back' });
    const c = ctx({ x: 5, y: 5 }, { x: 50, y: 50 });
    expect(b.onEnd!(c, moveEnd())).toBeNull();
  });

  it('defers (returns undefined) when a snap is active', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const c = ctx({ x: 5, y: 5 }, { x: 50, y: 50 });
    c.snap = { parentId: 'box', slotPose: { x: 0, y: 0 } };
    expect(b.onEnd!(c, moveEnd())).toBeUndefined();
  });

  it('measures the release on an outermost dragged node, not one carried inside it', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const c = ctx({ x: 5, y: 5 }, { x: 5, y: 5 });
    c.draggedIds = ['a', 'g'];
    c.origin.set('g', { x: 0, y: 0 });
    c.current.set('g', { x: 50, y: 50 });
    c.adapter = { ...c.adapter, getParent: (id: string) => (id === 'a' ? 'g' : null) } as any;
    expect(b.onEnd!(c, moveEnd())).toHaveLength(1);
  });

  it('deletes only the outermost dragged nodes, since a delete takes its subtree', () => {
    const b = snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' });
    const nodes = [{ id: 'g' }, { id: 'a' }, { id: 'b' }];
    const c = ctx({ x: 5, y: 5 }, { x: 50, y: 50 });
    c.draggedIds = ['a', 'g', 'b'];
    for (const id of ['g', 'b']) {
      c.origin.set(id, { x: 5, y: 5 });
      c.current.set(id, { x: 50, y: 50 });
    }
    c.adapter = { getNode: (id: string) => nodes.find((n) => n.id === id), getNodes: () => nodes, getParent: (id: string) => (id === 'a' ? 'g' : null) } as any;
    b.onStart!(c);
    const ops = b.onEnd!(c, moveEnd()) as any[];
    expect(ops.map((op) => op.args.node.id)).toEqual(['b', 'g']);
  });

  it('measures the radius in world units under a scaled frame', () => {
    const b = snapBackOrDelete<Pose>({ radius: 5, onFreeRelease: 'delete' });
    const c = ctx({ x: 0, y: 0 }, { x: 3, y: 0 });
    c.frames = { toWorld: (_id: string, p: Pose) => ({ x: p.x * 10, y: p.y * 10 }) } as any;
    expect(b.onEnd!(c, moveEnd())).toHaveLength(1);
  });
});
