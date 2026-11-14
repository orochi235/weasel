import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryStep, SerializedOp } from '@weasel-js/history';
import { createScene } from './scene';
import type { RectPose } from '../geometry/unionBounds';

type Data = { fill: string };
const make = () => createScene<Data, 'main' | 'top', RectPose>({
  systemLayers: [{ id: 'main' }, { id: 'top' }],
  coalesceWindowMs: 500,
});
const box = (x: number): RectPose => ({ x, y: 0, width: 5, height: 5 });

/** What a sync layer sends for one step: its applied ops, through JSON. */
const wire = (step: HistoryStep): SerializedOp[] =>
  JSON.parse(JSON.stringify(step.entries.flatMap((e) => e.applied).map((op) => ({ name: op.name!, args: op.args }))));

/** `a`'s edits replayed on `b` as they are made, and every step `b` reports. */
function linked() {
  const a = make();
  const b = make();
  const bHeard: HistoryStep[] = [];
  a.history.observe((step) => b.replay(wire(step)));
  b.history.observe((step) => bHeard.push(step));
  return { a, b, bHeard };
}

describe('Scene.replay', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('makes a peer equal across edits, undo, redo and a history jump, recording nothing there', () => {
    const { a, b, bHeard } = linked();
    const bVersion = b.history.getVersion();
    const g = a.add({ kind: 'group', layer: 'main', pose: box(0), data: { fill: 'none' } });
    const m = a.add({ kind: 'mark', layer: 'main', pose: box(1), data: { fill: 'red' }, parent: g });
    const n = a.add({ kind: 'mark', layer: 'main', pose: box(2), data: { fill: 'blue' } });
    vi.advanceTimersByTime(1000);
    a.setPose(m, box(3));
    vi.advanceTimersByTime(100);
    a.setPose(m, box(4));
    vi.advanceTimersByTime(1000);
    a.batch('Restyle', () => {
      a.update(n, { data: { fill: 'green' } });
      a.setLayer(n, 'top');
      a.move(n, g);
    });
    a.remove(m);
    expect(b.toJSON()).toEqual(a.toJSON());

    a.undo();
    a.undo();
    expect(b.toJSON()).toEqual(a.toJSON());
    expect(b.get(m)?.pose).toEqual(box(4));
    a.undo();
    expect(b.get(m)?.pose).toEqual(box(1));
    a.redo();
    expect(b.toJSON()).toEqual(a.toJSON());
    a.jumpToHistoryIndex(1);
    expect(b.toJSON()).toEqual(a.toJSON());
    a.jumpToHistoryIndex(Number.POSITIVE_INFINITY);
    expect(b.toJSON()).toEqual(a.toJSON());
    expect(b.nodes.has(m)).toBe(false);

    expect(bHeard).toEqual([]);
    expect(b.history.getVersion()).toBe(bVersion);
    expect(b.historyEntries()).toEqual([]);
    expect(b.canUndo()).toBe(false);
  });

  it('applies a kind registerOp taught, and its undo, when both scenes register it', () => {
    const { a, b } = linked();
    const seen: Record<string, string[]> = { a: [], b: [] };
    for (const [key, s] of [['a', a], ['b', b]] as const) {
      s.registerOp<string>('app:tag', {
        apply: (tag) => { seen[key]!.push(tag); },
        revert: (tag) => { seen[key]!.splice(seen[key]!.lastIndexOf(tag), 1); },
      });
    }
    a.recordOp({ kind: 'app:tag', payload: 'x' });
    expect(seen.b).toEqual(['x']);
    a.undo();
    expect(seen.b).toEqual([]);
    a.redo();
    expect(seen.b).toEqual(['x']);
  });

  it('keeps an edit made after a replay out of the entry before it', () => {
    const a = make();
    const b = make();
    const id = b.add({ kind: 'mark', layer: 'main', pose: box(0), data: { fill: 'red' } });
    a.loadState(b.toJSON());
    b.setPose(id, box(1));
    a.history.observe((step) => b.replay(wire(step)));
    a.update(id, { data: { fill: 'blue' } });
    b.setPose(id, box(2));
    expect(b.historyEntries()).toHaveLength(3);
    b.undo();
    expect(b.get(id)?.pose).toEqual(box(1));
  });

  it('throws on an unknown name before applying anything', () => {
    const b = make();
    const before = b.toJSON();
    const a = make();
    const steps: HistoryStep[] = [];
    a.history.observe((s) => steps.push(s));
    a.add({ kind: 'mark', layer: 'main', pose: box(0), data: { fill: 'red' } });
    expect(() => b.replay([...wire(steps[0]!), { name: 'app:unknown', args: null }])).toThrow(/app:unknown/);
    expect(b.toJSON()).toEqual(before);
  });

  it('takes back what it applied when an op does not fit the peer', () => {
    const a = make();
    const steps: HistoryStep[] = [];
    a.history.observe((s) => steps.push(s));
    a.batch('Two', () => {
      a.add({ kind: 'mark', layer: 'main', pose: box(0), data: { fill: 'red' }, id: 'fresh' });
      a.add({ kind: 'mark', layer: 'main', pose: box(1), data: { fill: 'red' }, id: 'taken' });
    });
    const b = make();
    b.add({ kind: 'mark', layer: 'main', pose: box(9), data: { fill: 'gray' }, id: 'taken' });
    const before = b.toJSON();
    expect(() => b.replay(wire(steps[0]!))).toThrow(/taken/);
    expect(b.toJSON()).toEqual(before);
  });

  it('refuses inside another edit', () => {
    const b = make();
    expect(() => b.batch('Outer', () => b.replay([]))).toThrow(/inside another edit/);
  });
});
