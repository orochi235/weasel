import { describe, it, expect } from 'vitest';
import { createTraceRing } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { HISTORY_RECORD_LIMITS, recordHistory } from './history';
import type { DevtoolsHistoryRecord } from './protocol';

function setup(dev = true) {
  const scene = createScene<{ label: string }, string>({ systemLayers: [{ id: 'main' }] });
  const ring = createTraceRing<DevtoolsHistoryRecord>(200, dev);
  const stop = recordHistory(scene.history, ring);
  const add = (label: string) => scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label } });
  return { scene, ring, stop, add };
}

describe('recordHistory', () => {
  it('records each edit as a push naming its ops, their targets and where the history stands', () => {
    const t = setup();
    const id = t.add('a');
    t.scene.setPose(id as NodeId, { x: 5, y: 0, width: 1, height: 1 });
    const { entries } = t.ring.since(0);
    expect(entries.map((r) => [r.step, r.position])).toEqual([
      ['push', { index: 1, total: 1 }],
      ['push', { index: 2, total: 2 }],
    ]);
    const op = entries[1]!.entries[0]!.ops[0]!;
    expect(op).toMatchObject({ targets: [id] });
    expect(op.kind).toMatch(/^kit:/);
    expect(entries[1]!.entries[0]!.opCount).toBe(1);
  });

  it('records undo and redo with the entry each stepped across', () => {
    const t = setup();
    t.add('a');
    t.scene.undo();
    t.scene.redo();
    expect(t.ring.since(0).entries.map((r) => [r.step, r.entries.map((e) => e.id), r.position.index])).toEqual([
      ['push', [1], 1], ['undo', [1], 0], ['redo', [1], 1],
    ]);
  });

  it('caps the entries and ops one record carries, counting what it cut', () => {
    const t = setup();
    const id = t.add('a');
    const many = HISTORY_RECORD_LIMITS.ops + 5;
    t.scene.batch('wiggle', () => {
      for (let i = 0; i < many; i++) t.scene.setPose(id as NodeId, { x: i, y: 0, width: 1, height: 1 });
    });
    const last = t.ring.since(0).entries.at(-1)!;
    expect(last.entries[0]!.ops).toHaveLength(HISTORY_RECORD_LIMITS.ops);
    expect(last.entries[0]!.opCount).toBe(many);
  });

  it('keeps nothing in a production build until something watches the ring, and stops when released', () => {
    const t = setup(false);
    t.add('a');
    expect(t.ring.since(0).entries).toEqual([]);
    const release = t.ring.watch();
    t.add('b');
    expect(t.ring.since(0).entries).toHaveLength(1);
    release();
    t.stop();
    const unwatched = t.ring.watch();
    t.add('c');
    unwatched();
    expect(t.ring.since(0).entries).toHaveLength(1);
  });
});
