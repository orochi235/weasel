import { describe, expect, it } from 'vitest';
import { createHistory } from '@weasel-js/history';
import type { SerializedHistory } from '@weasel-js/history';
import type { Op } from '@weasel-js/core';
import { reviveTypedArrays, serializeReplacer } from './persistence';

// These cover the new bit of App's localStorage autosave: the undo history is
// now persisted alongside the scene. The risk is that a history snapshot's
// serialized op payloads carry path poses (Float32Array coords / Uint8Array
// commands) which JSON mangles unless tagged. `serializeReplacer` +
// `reviveTypedArrays` are the same helpers App uses on both keys.

describe('persistence — history snapshot round-trip', () => {
  it('revives Float32Array / Uint8Array op payloads through the JSON hop', () => {
    const snap: SerializedHistory = {
      version: 1,
      undoStack: [{
        id: 1,
        label: 'setPath',
        forwardOps: [{
          name: 'kit:setPath',
          args: { coords: new Float32Array([1.5, 2.5, 3.5]), commands: new Uint8Array([0, 1, 2]) },
        }],
        baseOps: [],
      }],
      redoStack: [],
      nextEntryId: 2,
      droppedEntries: 0,
    };

    const wire = JSON.stringify(snap, serializeReplacer);
    const revived = reviveTypedArrays(JSON.parse(wire) as SerializedHistory);

    const args = revived.undoStack[0].forwardOps[0].args as { coords: unknown; commands: unknown };
    expect(args.coords).toBeInstanceOf(Float32Array);
    expect(Array.from(args.coords as Float32Array)).toEqual([1.5, 2.5, 3.5]);
    expect(args.commands).toBeInstanceOf(Uint8Array);
    expect(Array.from(args.commands as Uint8Array)).toEqual([0, 1, 2]);
    // Structural fields survive untouched.
    expect(revived.version).toBe(1);
    expect(revived.undoStack[0].label).toBe('setPath');
    expect(revived.nextEntryId).toBe(2);
  });

  it('a live History survives serialize → JSON → restore with its undo stack intact', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const op = {
      name: 'test:push',
      args: { value: 7 },
      apply: (a: { values: number[] }) => { a.values.push(7); },
      invert: () => ({
        name: 'test:pop',
        args: {},
        apply: (a: { values: number[] }) => { a.values.pop(); },
        invert: () => op,
      }),
    } as unknown as Op;
    op.apply(adapter);
    h.recordEntry([op], 'push 7');
    expect(h.canUndo()).toBe(true);

    // The App-level round-trip: serialize, stringify+parse through localStorage,
    // revive typed arrays, restore into a fresh History.
    const wire = JSON.stringify(h.serialize(), serializeReplacer);
    const revived = reviveTypedArrays(JSON.parse(wire) as SerializedHistory);

    const h2 = createHistory({ values: [] as number[] });
    h2.restore(revived);

    expect(h2.canUndo()).toBe(true);
    expect(h2.entries().undo.map((e) => e.label)).toEqual(['push 7']);
  });
});
