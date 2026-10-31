import { describe, expect, it, vi } from 'vitest';
import { createHistory } from '@weasel-js/history';
import type { SerializedHistory } from '@weasel-js/history';
import type { Op, SerializedScene } from '@weasel-js/core';
import {
  asNodeId, buildWeaselClipboardText, createScene, effectivePose, isAnnotationNode, measureNode, measurementOf,
  parseWeaselClipboardText,
} from '@weasel-js/core';
import {
  ANNOTATION_LAYER, DRAW_LAYERS, DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose,
} from './drawDocument';
import { reviveTypedArrays, serializeReplacer } from '@weasel-js/editor';
import { clipboardJsonReviver, nodeSpecsFromSnapshot, reviveSnapshot } from './persistence';

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
    expect(parsed.nodes[0].fill).toEqual({ paint: { color: '#fff' } });
  });
});

describe('persistence — saved measurements', () => {
  it('saves measurements with the document and loads them back on the annotation layer', () => {
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
    scene.add(measureNode(asNodeId('m'), ANNOTATION_LAYER, { x: 0, y: 0 }, { x: 30, y: 40 }) as never);
    const saved = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const back = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
      systemLayers: DRAW_LAYERS,
      initial: nodeSpecsFromSnapshot(saved),
    });
    const node = back.get(asNodeId('m'));
    expect(node?.layer).toBe(ANNOTATION_LAYER);
    expect(isAnnotationNode(back, 'm')).toBe(true);
    expect(measurementOf(node)).toMatchObject({ dx: 30, dy: 40, distance: 50 });
  });
});

describe('persistence — image pattern fills', () => {
  it('keeps the picture itself, so a reload needs nothing stored beside the scene', () => {
    const paint = {
      kind: 'image' as const, src: 'data:image/png;base64,iVBORw0KGgo=', width: 64, height: 32,
      units: 'bounds' as const, transform: [0, 1, -1, 0] as const,
    };
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
    scene.add({
      id: asNodeId('a'), kind: 'mark', layer: 'default' as WeaselDrawLayer,
      pose: { x: 0, y: 0, width: 10, height: 10 }, data: { fill: { paint } },
    });
    const saved = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const [node] = nodeSpecsFromSnapshot(saved, DRAW_REGISTRY);
    expect((node!.data as WeaselDrawData).fill).toEqual({ paint });
  });
});

// `collapse WeaselDraw's own fill and stroke onto the kit shapes` (7af35c53,
// 2026-08-26) dropped `WeaselDrawData`'s `fill?: string` / `stroke?: string` /
// `strokeWidth?: number` in favor of the kit's `Paint` and `Stroke`
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
    version: 3,
    systemLayers: [{ id: 'default' }],
    nodes: [{ id: 'a', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data }],
  });
  const dataOf = (data: Data): Data => nodeSpecsFromSnapshot(sceneOf(data))[0].data as Data;

  it('turns a string fill into a solid Fill', () => {
    expect(dataOf({ fill: '#7ab8d4' }).fill).toEqual({ paint: { color: '#7ab8d4' } });
  });

  it('moves a string fill\'s hex alpha to opacity, as `solid` does', () => {
    expect(dataOf({ fill: '#7ab8d480' }).fill).toEqual({ paint: { color: '#7ab8d4', opacity: 128 / 255 } });
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

  it('moves a paint\'s tag from `fill` to `kind` rather than reading it as a color', () => {
    const old = { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#fff' }] };
    const { kind: kind, ...rest } = old;
    expect(dataOf({ fill: structuredClone(old) }).fill).toEqual({ paint: { kind, ...rest } });
    expect(dataOf({ fill: { kind: 'solid', color: '#abc' } }).fill).toEqual({ paint: { kind: 'solid', color: '#abc' } });
  });

  it('lifts a pattern paint\'s tile into the paint, as its kind', () => {
    const old = { kind: 'hatch', color: '#a840a2', size: 10, units: 'bounds' };
    expect(dataOf({ fill: old }).fill).toEqual({ paint: { kind: 'hatch', color: '#a840a2', size: 10, units: 'bounds' } });
  });

  it('turns a pattern paint holding a texture handle into a texture paint', () => {
    const old = { kind: 'texture', texture: { id: 'tex_1' }, origin: { x: 1, y: 2 } };
    expect(dataOf({ fill: old }).fill).toEqual({ paint: { kind: 'texture', texture: { id: 'tex_1' }, origin: { x: 1, y: 2 } } });
  });

  it('wraps a paint held directly under `fill` in a Fill', () => {
    const gradient = { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#fff' }] };
    expect(dataOf({ fill: structuredClone(gradient) }).fill).toEqual({ paint: gradient });
    expect(dataOf({ fill: { color: '#abc' } }).fill).toEqual({ paint: { color: '#abc' } });
    expect(dataOf({ fill: { kind: 'hatch', color: '#abc' } }).fill).toEqual({ paint: { kind: 'hatch', color: '#abc' } });
  });

  it('leaves a Fill alone, and the paint inside it', () => {
    const fill = { paint: { kind: 'solid', color: '#abc' } };
    expect(dataOf({ fill: structuredClone(fill) }).fill).toEqual(fill);
    expect(dataOf({ fill: {} }).fill).toEqual({});
  });

  it('keeps an explicit no-fill as null', () => {
    expect(dataOf({ fill: null }).fill).toBeNull();
  });

  it('wraps only what sits under `fill`: a stroke keeps its paint where it is', () => {
    const stroke = { paint: { color: '#0a3654' }, width: 2 };
    expect(dataOf({ stroke: structuredClone(stroke) }).stroke).toEqual(stroke);
  });

  it('leaves an SVG gradient paint under `fill` alone', () => {
    const fill = { kind: 'gradient', paint: { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [] } };
    expect(dataOf({ fill: structuredClone(fill) }).fill).toEqual(fill);
  });

  it('migrates a text node\'s style fill, which carried the same string', () => {
    expect(dataOf({ text: 'hi', style: { fill: '#112233' } }).style).toEqual({ fill: { paint: { color: '#112233' } } });
  });

  it('wraps the fill of a text style and of each run', () => {
    const data = dataOf({
      text: 'hi',
      style: { fill: { color: '#112233' } },
      runs: [{ text: 'h', fill: { color: '#f00' } }, { text: 'i', fill: null }],
    });
    expect(data.style).toEqual({ fill: { paint: { color: '#112233' } } });
    expect(data.runs).toEqual([{ text: 'h', fill: { paint: { color: '#f00' } } }, { text: 'i', fill: null }]);
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
    expect(args.from).toEqual({ fill: { paint: { color: '#7ab8d4' } }, stroke: { paint: { color: '#0a3654' }, width: 2 } });
    expect(args.to).toEqual({ fill: { paint: { color: '#ff0000' } } });
  });

  it('still revives typed arrays — both passes run', () => {
    const data = dataOf({ fill: '#7ab8d4', coords: [1.5, 2.5] });
    expect(data.coords).toBeInstanceOf(Float32Array);
    expect(data.fill).toEqual({ paint: { color: '#7ab8d4' } });
  });
});

describe('persistence — corner shape', () => {
  it("keeps a path's corner specs through the JSON hop", () => {
    const path = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1, 1, 1, 4]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
      corners: [null, { shape: 'bevel', radius: 3 }],
    };
    const wire = JSON.stringify({ path }, serializeReplacer);
    const revived = reviveTypedArrays(JSON.parse(wire) as { path: typeof path });
    expect(revived.path.corners).toEqual([null, { shape: 'bevel', radius: 3 }]);
    expect(revived.path.coords).toBeInstanceOf(Float32Array);
  });
});

describe('persistence — a group reopens tracking its members', () => {
  it('restores dependsOn and the derived pose, so moving a member moves the group', () => {
    const make = (initial?: Parameters<typeof createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>[0]['initial']) =>
      createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
        systemLayers: [{ id: 'default' }], registry: DRAW_REGISTRY, ...(initial ? { initial } : {}),
      });
    const scene = make();
    const g = scene.add({
      kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: 'children', derivePose: DRAW_REGISTRY.derivePose!['kit:unionOfChildren'],
    });
    const a = scene.add({ kind: 'mark', layer: 'default', pose: { x: 10, y: 10, width: 20, height: 20 }, data: {}, parent: g });

    const json = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const reopened = make(nodeSpecsFromSnapshot(json, DRAW_REGISTRY));
    reopened.setPose(a, { x: 100, y: 10, width: 20, height: 20 });

    expect(effectivePose(reopened, reopened.get(g)!)).toMatchObject({ x: 100, y: 10, width: 20, height: 20 });
  });
});

describe('persistence — keys this build lacks', () => {
  it('loads a node naming one without it, and says which', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const saved = {
      version: 2, systemLayers: [{ id: 'default' }],
      nodes: [{ id: 'g', kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {}, copiesFromPoseKey: 'gone' }],
    } as unknown as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const [g] = nodeSpecsFromSnapshot(saved, DRAW_REGISTRY);
    expect(g!.copiesFromPose).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/"g".*copiesFromPose.*"gone"/));
    warn.mockRestore();
  });
});
