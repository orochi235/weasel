import { describe, expect, it, vi } from 'vitest';
import { createAnnotationStore, createAnnotationScene, annotationsFromJSON } from './store';
import type { AnnotationInit, AnnotationTargetInfo } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'naive', content: { w: 256, h: 170 }, positionDependsOn: ['angle', 'shading'] },
  { id: 'occt', content: { w: 256, h: 170 } },
];

function makeStore() {
  const scene = createAnnotationScene();
  return createAnnotationStore({ scene, targets: () => TARGETS });
}

const RING: AnnotationInit = {
  target: 'naive',
  kind: 'rect',
  frac: { x: 0.3322, y: 0.3581, w: 0.02, h: 0.0861 },
  title: 'spurious ring at r=12.80',
  status: 'open',
  tags: ['geometry'],
  meta: { engines: ['naive'] },
};

describe('the annotation store', () => {
  it('round-trips every field through add and get', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });
    const got = store.get(id);
    expect(got).toMatchObject({
      id,
      target: 'naive',
      kind: 'rect',
      frac: RING.frac,
      title: RING.title,
      status: 'open',
      tags: ['geometry'],
      meta: { engines: ['naive'] },
      seen: { angle: 'iso', shading: 'outline' },
    });
  });

  it('dates a mark only by the keys its target declared', () => {
    const store = makeStore();
    const onOcct = store.add({ ...RING, target: 'occt' }, { angle: 'iso' });
    // 'occt' declares no dependencies, so nothing is worth snapshotting.
    expect(store.get(onOcct)?.seen).toEqual({});
  });

  it('filters by target, kind, status, tags and a predicate', () => {
    const store = makeStore();
    store.add(RING);
    store.add({ ...RING, target: 'occt', status: 'fixed', tags: ['shading'] });
    store.add({ ...RING, kind: 'line', tags: ['geometry', 'edge'] });

    expect(store.query({ target: 'naive' })).toHaveLength(2);
    expect(store.query({ kind: 'line' })).toHaveLength(1);
    expect(store.query({ status: 'fixed' })).toHaveLength(1);
    expect(store.query({ tags: ['geometry'] })).toHaveLength(2);
    // Every listed tag must be present, not just one.
    expect(store.query({ tags: ['geometry', 'edge'] })).toHaveLength(1);
    expect(store.query({ where: (a) => a.title === RING.title })).toHaveLength(3);
    expect(store.query()).toHaveLength(3);
  });

  it('hit-tests a point, and widens the hit by the tolerance', () => {
    const store = makeStore();
    const id = store.add({ ...RING, frac: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } });

    expect(store.hitTest('naive', { x: 0.3, y: 0.3 }).map((a) => a.id)).toEqual([id]);
    expect(store.hitTest('naive', { x: 0.15, y: 0.3 })).toHaveLength(0);
    expect(store.hitTest('naive', { x: 0.15, y: 0.3 }, 0.06)).toHaveLength(1);
    // A target's marks are its own.
    expect(store.hitTest('occt', { x: 0.3, y: 0.3 })).toHaveLength(0);
  });

  it('takes what a box encloses, not what it grazes', () => {
    const store = makeStore();
    // The box is (0.2,0.2)-(0.6,0.6). `straddling` overlaps it but hangs out
    // past the far corner — the case that separates enclosure from mere
    // overlap. Two marks that are both wholly outside would not.
    const inside = store.add({ ...RING, frac: { x: 0.3, y: 0.3, w: 0.1, h: 0.1 } });
    store.add({ ...RING, frac: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 } });
    store.add({ ...RING, frac: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 } });

    const got = store.within('naive', { x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
    expect(got.map((a) => a.id)).toEqual([inside]);
  });

  it('patches meaning without moving geometry, and geometry without losing meaning', () => {
    const store = makeStore();
    const id = store.add(RING);

    store.update(id, { status: 'fixed' });
    expect(store.get(id)?.status).toBe('fixed');
    expect(store.get(id)?.frac).toEqual(RING.frac);

    store.update(id, { frac: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } });
    expect(store.get(id)?.frac).toEqual({ x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(store.get(id)?.status).toBe('fixed');
    expect(store.get(id)?.title).toBe(RING.title);
  });

  it('replaces meta and nothing else', () => {
    const store = makeStore();
    const id = store.add(RING);
    store.setMeta(id, { engines: ['naive', 'occt'] });
    expect(store.get(id)?.meta).toEqual({ engines: ['naive', 'occt'] });
    expect(store.get(id)?.title).toBe(RING.title);
  });

  it('removes a mark', () => {
    const store = makeStore();
    const id = store.add(RING);
    store.remove(id);
    expect(store.get(id)).toBeUndefined();
    expect(store.query()).toHaveLength(0);
  });

  it('answers staleness from the target the mark is on', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });
    const mark = store.get(id);
    if (!mark) throw new Error('unreachable');

    expect(store.isStale(mark, { angle: 'iso', shading: 'outline' })).toBe(false);
    expect(store.isStale(mark, { angle: 'top', shading: 'outline' })).toBe(true);
    // render_px is not declared, so it cannot make anything stale.
    expect(store.isStale(mark, { angle: 'iso', shading: 'outline', render_px: 1 })).toBe(false);
  });

  it('notifies subscribers on each mutation, and stops after unsubscribe', () => {
    const store = makeStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);

    const id = store.add(RING);
    store.update(id, { status: 'fixed' });
    store.remove(id);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3);

    const before = fn.mock.calls.length;
    off();
    store.add(RING);
    expect(fn.mock.calls.length).toBe(before);
  });

  it('round-trips through JSON, and the snapshot is JSON-clean', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });

    const out = store.toJSON();
    // Assert JSON-safety directly rather than trusting the shape by eye:
    // labkit stringifies record.state raw, because Instrument.serialize never
    // runs, so a Map or a class instance in here would be lost silently.
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    expect(out.version).toBe(1);

    const revived = annotationsFromJSON(JSON.parse(JSON.stringify(out)), () => TARGETS);
    expect(revived.get(id)).toEqual(store.get(id));
    expect(revived.query()).toHaveLength(1);
  });
});
