import { describe, expect, it } from 'vitest';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';
import { bumpNodeMemoGeneration } from './nodeMemo';
import { JOURNAL_CAPACITY } from './touchJournal';
import type { NodeId, Scene } from './types';

type S = Scene<Data, Layer>;

const mark = (s: S, parent?: NodeId): NodeId =>
  s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'm' }, ...(parent ? { parent } : {}) });
const group = (s: S): NodeId =>
  s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'g' } });

/** The ids touched by `edit`, sorted. */
function touchedBy(s: S, edit: () => void): NodeId[] | 'unknown' {
  const { token } = s.changesSince();
  edit();
  const { ids } = s.changesSince(token);
  return ids === 'unknown' ? ids : [...ids].sort();
}

describe('scene.changesSince', () => {
  it('answers unknown without a token, and nothing for a token with no change since', () => {
    const s = makeScene();
    mark(s);
    const first = s.changesSince();
    expect(first.ids).toBe('unknown');
    expect(s.changesSince(first.token).ids).toEqual(new Set());
  });

  it('names the node a pose or data edit changed, and no other', () => {
    const s = makeScene();
    const a = mark(s);
    mark(s);
    expect(touchedBy(s, () => s.setPose(a, { ...POSE, x: 5 }))).toEqual([a]);
    expect(touchedBy(s, () => s.update(a, { data: { label: 'z' } }))).toEqual([a]);
  });

  it('names the edited node again when the edit is undone', () => {
    const s = makeScene();
    const a = mark(s);
    s.setPose(a, { ...POSE, x: 5 });
    expect(touchedBy(s, () => s.undo())).toEqual([a]);
  });

  it('reports an add, a remove and a move as structural, with the parents whose children changed', () => {
    const s = makeScene();
    const g = group(s);
    let a = '' as NodeId;
    const { token } = s.changesSince();
    a = mark(s, g);
    const added = s.changesSince(token);
    expect(added.structural).toBe(true);
    expect([...added.parents]).toEqual([g]);
    expect(added.ids).toEqual(new Set([a]));

    const moved = s.changesSince(added.token);
    s.move(a, null);
    const after = s.changesSince(moved.token);
    expect(new Set(after.parents)).toEqual(new Set([g, null]));

    const before = s.changesSince(after.token);
    s.remove(a);
    const removed = s.changesSince(before.token);
    expect(removed.structural).toBe(true);
    expect(removed.ids).toEqual(new Set([a]));
    expect([...removed.parents]).toEqual([null]);
  });

  it('reports a layer change as structural with no parent', () => {
    const s = makeScene();
    const a = mark(s);
    const { token } = s.changesSince();
    s.setLayer(a, 'plantings');
    const span = s.changesSince(token);
    expect(span.structural).toBe(true);
    expect(span.parents.size).toBe(0);
    expect(span.ids).toEqual(new Set([a]));
  });

  it('reaches every descendant of a changed container: a frame it defines, a paint they inherit', () => {
    const s = makeScene();
    const g = group(s);
    const a = mark(s, g);
    const b = mark(s, g);
    mark(s);
    expect(touchedBy(s, () => s.setPose(g, { ...POSE, x: 3 }))).toEqual([g, a, b].sort());
    expect(touchedBy(s, () => s.update(g, { data: { label: 'fill' } }))).toEqual([g, a, b].sort());
  });

  it('names the container a node leaves on undo, not the one its entry recorded, after an untracked move', () => {
    const s = makeScene();
    const p = group(s);
    const q = group(s);
    const x = mark(s, p);
    s.untracked(() => s.move(x, q));
    const { token } = s.changesSince();
    s.undo();
    expect(s.get(x)).toBeUndefined();
    expect(s.changesSince(token).parents.has(q)).toBe(true);
  });

  it('reaches the nodes that derive from a changed one', () => {
    const s = makeScene();
    const a = mark(s);
    const b = mark(s);
    const edge = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'e' }, dependsOn: [a, b] });
    expect(touchedBy(s, () => s.setPose(a, { ...POSE, x: 9 }))).toEqual([a, edge].sort());
  });

  it('reaches the nodes that derive from one that left the scene', () => {
    const s = makeScene();
    const x = 'x' as NodeId;
    const edge = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'e' }, dependsOn: [x] });
    s.add({ id: x, kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'x' } });
    expect(touchedBy(s, () => s.undo())).toEqual([edge, x].sort());
    s.redo();
    expect(touchedBy(s, () => s.remove(x))).toEqual([edge, x].sort());
  });

  it('names the nodes a pose preview set and cleared, one a frame', () => {
    const s = makeScene();
    const a = mark(s);
    const b = mark(s);
    expect(touchedBy(s, () => s.overrides.set(a, { pose: { ...POSE, x: 1 } }))).toEqual([a]);
    expect(touchedBy(s, () => s.overrides.set(a, { pose: { ...POSE, x: 2 } }))).toEqual([a]);
    expect(touchedBy(s, () => { s.overrides.clear(a); s.overrides.set(b, { pose: POSE }); })).toEqual([a, b].sort());
  });

  it('names a container a scroll moved, and its children', () => {
    const s = makeScene();
    const g = group(s);
    const a = mark(s, g);
    expect(touchedBy(s, () => s.scroll!.set(g, { x: 0, y: 40 }))).toEqual([g, a].sort());
  });

  it('answers unknown after a consumer op, which names nothing it reaches', () => {
    const s = makeScene();
    s.registerOp<null>('app:noop', { apply: () => {}, revert: () => {} });
    expect(touchedBy(s, () => s.recordOp({ kind: 'app:noop', payload: null }))).toBe('unknown');
  });

  it('answers unknown after a layer record changes, or an ambient generation moves', () => {
    const s = makeScene();
    mark(s);
    expect(touchedBy(s, () => s.setLayerVisible('plantings', false))).toBe('unknown');
    expect(touchedBy(s, () => bumpNodeMemoGeneration())).toBe('unknown');
  });

  it('answers unknown to a reader the journal no longer reaches back to', () => {
    const s = makeScene();
    const a = mark(s);
    expect(touchedBy(s, () => {
      for (let i = 1; i <= JOURNAL_CAPACITY + 1; i++) s.setPose(a, { ...POSE, x: i });
    })).toBe('unknown');
  });

  it('answers unknown across a loadState', () => {
    const s = makeScene();
    mark(s);
    const saved = s.toJSON();
    expect(touchedBy(s, () => s.loadState(saved))).toBe('unknown');
  });
});
