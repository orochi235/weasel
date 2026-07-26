import { describe, expect, it } from 'vitest';
import { createHistory } from '@weasel-js/history';
import type { SerializedHistory } from '@weasel-js/history';
import type { Op, SerializedScene } from '@weasel-js/core';
import { asNodeId, buildWeaselClipboardText, parseWeaselClipboardText } from '@weasel-js/core';
import { clipboardJsonReviver, nodeSpecsFromSnapshot, reviveTypedArrays, serializeReplacer } from './persistence';

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

// Regression: `IngestCtx.clipboard.reviver` is a `JSON.parse`-style
// `(key, value)` reviver, but draw originally wired the one-arg tree walker
// `reviveTypedArrays` straight in. Called as a reviver, the walker receives
// the KEY (a string) and returns it, collapsing every parsed value to its
// key — the root call yields `''`, `parseWeaselClipboardText` returns null,
// and the weasel-JSON paste handler silently declines. `clipboardJsonReviver`
// adapts the walker to the reviver contract (one whole-tree pass at the
// root call).
describe('persistence — clipboard JSON reviver', () => {
  it('revives a weasel clipboard payload through parseWeaselClipboardText', () => {
    const items = [{
      id: 'a',
      data: { path: { coords: new Float32Array([1.5, 2.5]), commands: new Uint8Array([0, 1]) } },
    }];
    const wire = buildWeaselClipboardText(items, serializeReplacer);

    const nodes = parseWeaselClipboardText(wire, clipboardJsonReviver);

    expect(nodes).not.toBeNull();
    const path = (nodes![0] as { data: { path: { coords: unknown; commands: unknown } } }).data.path;
    expect(path.coords).toBeInstanceOf(Float32Array);
    expect(Array.from(path.coords as Float32Array)).toEqual([1.5, 2.5]);
    expect(path.commands).toBeInstanceOf(Uint8Array);
    expect(Array.from(path.commands as Uint8Array)).toEqual([0, 1]);
  });

  it('preserves plain values untouched at non-root keys', () => {
    const parsed = JSON.parse('{"weaselClipboard":1,"nodes":[{"id":"a","fill":"#fff"}]}', clipboardJsonReviver) as {
      weaselClipboard: number; nodes: Array<{ id: string; fill: string }>;
    };
    expect(parsed.weaselClipboard).toBe(1);
    expect(parsed.nodes[0]).toEqual({ id: 'a', fill: '#fff' });
  });
});

// Regression for the reload bug where `loadInitial` filtered `kind === 'leaf'`
// and dropped `parent`, flattening every node onto the default layer — so
// containers (Cmd+G groups) and nesting were lost on reload even though
// `toJSON()` persisted the full tree. `nodeSpecsFromSnapshot` rebuilds the
// full node list (containers + parent links + layers).
describe('persistence — scene snapshot → node specs', () => {
  type Data = { kind?: string; fill?: string; coords?: unknown };
  type Layer = 'default';
  type Pose = { x: number; y: number; width: number; height: number };

  it('preserves containers and parent links so nesting survives reload', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 1,
      systemLayers: [{ id: 'default' }],
      // Layer-major DFS-preorder, exactly as toJSON() emits: parent before child.
      nodes: [
        { id: 'g', kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'group' } },
        { id: 'a', kind: 'leaf', layer: 'default', pose: { x: 10, y: 10, width: 20, height: 20 }, data: { fill: '#fff' }, parent: 'g' },
        { id: 'b', kind: 'leaf', layer: 'default', pose: { x: 50, y: 0, width: 20, height: 20 }, data: { fill: '#000' } },
      ],
    };

    const specs = nodeSpecsFromSnapshot(json);

    // All three nodes survive, in preorder.
    expect(specs.map((s) => s.id)).toEqual([asNodeId('g'), asNodeId('a'), asNodeId('b')]);
    // The container is restored as a container (not filtered out).
    expect(specs.find((s) => s.id === asNodeId('g'))!.kind).toBe('container');
    // The nested leaf keeps its parent link.
    expect(specs.find((s) => s.id === asNodeId('a'))!.parent).toBe(asNodeId('g'));
    // The root leaf has no parent.
    expect(specs.find((s) => s.id === asNodeId('b'))!.parent ?? null).toBeNull();
  });

  it('revives typed arrays inside node data', () => {
    const json: SerializedScene<Data, Layer, Pose> = {
      version: 1,
      systemLayers: [{ id: 'default' }],
      nodes: [
        { id: 'a', kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { coords: [1.5, 2.5, 3.5] } },
      ],
    };

    const specs = nodeSpecsFromSnapshot(json);
    const coords = (specs[0].data as { coords: unknown }).coords;
    expect(coords).toBeInstanceOf(Float32Array);
  });
});
