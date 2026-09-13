import { describe, expect, it } from 'vitest';
import { createHistory } from '@weasel-js/history';
import type { SerializedHistory } from '@weasel-js/history';
import type { Op, SerializedScene } from '@weasel-js/core';
import { asNodeId, buildWeaselClipboardText, parseWeaselClipboardText } from '@weasel-js/core';
import { clipboardJsonReviver, nodeSpecsFromSnapshot, reviveSnapshot, reviveTypedArrays, serializeReplacer } from './persistence';

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
    const parsed = JSON.parse('{"weaselClipboard":1,"nodes":[{"id":"a","label":"box"}]}', clipboardJsonReviver) as {
      weaselClipboard: number; nodes: Array<{ id: string; label: string }>;
    };
    expect(parsed.weaselClipboard).toBe(1);
    expect(parsed.nodes[0]).toEqual({ id: 'a', label: 'box' });
  });

  // A copy made in a tab running the pre-2026-08-26 build is the other way
  // legacy string paint reaches a current scene.
  it('migrates legacy string paint on paste', () => {
    const parsed = JSON.parse('{"weaselClipboard":1,"nodes":[{"id":"a","fill":"#fff"}]}', clipboardJsonReviver) as {
      nodes: Array<{ fill: unknown }>;
    };
    expect(parsed.nodes[0].fill).toEqual({ color: '#fff' });
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

// `collapse WeaselDraw's own fill and stroke onto the kit shapes` (7af35c53,
// 2026-08-26) dropped `WeaselDrawData`'s `fill?: string` / `stroke?: string` /
// `strokeWidth?: number` in favor of the kit's `FillStyle` and `Stroke`
// objects, and took every reader's tolerance for the string forms with them.
// Nothing converted the documents already in localStorage, so a scene saved
// before that date reached the renderer with `fill: '#7ab8d4'` and threw
// `parseColor: unrecognized color undefined` on every frame — a blank node,
// per-frame, with no way back.
describe('persistence — legacy string paint migration', () => {
  type Data = Record<string, unknown>;
  type Layer = 'default';
  type Pose = { x: number; y: number; width: number; height: number };

  const sceneOf = (data: Data): SerializedScene<Data, Layer, Pose> => ({
    version: 1,
    systemLayers: [{ id: 'default' }],
    nodes: [{ id: 'a', kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data }],
  });
  const dataOf = (data: Data): Data => nodeSpecsFromSnapshot(sceneOf(data))[0].data as Data;

  it('turns a string fill into a solid FillStyle', () => {
    expect(dataOf({ fill: '#7ab8d4' }).fill).toEqual({ color: '#7ab8d4' });
  });

  it('moves a string fill\'s hex alpha to opacity, as `solid` does', () => {
    expect(dataOf({ fill: '#7ab8d480' }).fill).toEqual({ color: '#7ab8d4', opacity: 128 / 255 });
  });

  it('turns a string stroke and its sibling strokeWidth into one Stroke', () => {
    const data = dataOf({ stroke: '#0a3654', strokeWidth: 2 });
    expect(data.stroke).toEqual({ paint: { color: '#0a3654' }, width: 2 });
    expect('strokeWidth' in data).toBe(false);
  });

  it('defaults a string stroke with no strokeWidth to width 1', () => {
    expect(dataOf({ stroke: '#0a3654' }).stroke).toEqual({ paint: { color: '#0a3654' }, width: 1 });
  });

  it('reads "none" as an explicit no-paint', () => {
    expect(dataOf({ fill: 'none', stroke: 'none' })).toMatchObject({ fill: null, stroke: null });
  });

  // The trap: `FillStyle` discriminates on a `fill` key whose value is the
  // string `'solid'` / `'linear-gradient'` / …, so "a string under `fill`"
  // alone would mangle every current paint into `{ color: 'solid' }`.
  it('leaves a current object paint alone, discriminant and all', () => {
    const fill = { fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#fff' }] };
    expect(dataOf({ fill: structuredClone(fill) }).fill).toEqual(fill);
    expect(dataOf({ fill: { fill: 'solid', color: '#abc' } }).fill).toEqual({ fill: 'solid', color: '#abc' });
  });

  it('migrates a text node\'s style fill, which carried the same string', () => {
    expect(dataOf({ text: 'hi', style: { fill: '#112233' } }).style).toEqual({ fill: { color: '#112233' } });
  });

  // The scene is only half of it: the undo stack persists its own copies of
  // node data inside `setData` op payloads, so an undo after a reload would
  // otherwise write a legacy string straight back into a migrated scene.
  it('migrates the node data carried inside a persisted history snapshot', () => {
    const snap = reviveSnapshot({
      version: 1,
      undoStack: [{
        id: 1, label: 'Nudge',
        forwardOps: [{ name: 'setData', args: { id: 'a', from: { fill: '#7ab8d4', stroke: '#0a3654', strokeWidth: 2 }, to: { fill: '#ff0000' } } }],
        inverseOps: [],
      }],
      redoStack: [], nextEntryId: 2, droppedEntries: 0,
    } as unknown as SerializedHistory) as unknown as {
      undoStack: { forwardOps: { args: { from: Data; to: Data } }[] }[];
    };
    const args = snap.undoStack[0].forwardOps[0].args;
    expect(args.from).toEqual({ fill: { color: '#7ab8d4' }, stroke: { paint: { color: '#0a3654' }, width: 2 } });
    expect(args.to).toEqual({ fill: { color: '#ff0000' } });
  });

  it('still revives typed arrays — both passes run', () => {
    const data = dataOf({ fill: '#7ab8d4', coords: [1.5, 2.5] });
    expect(data.coords).toBeInstanceOf(Float32Array);
    expect(data.fill).toEqual({ color: '#7ab8d4' });
  });
});
