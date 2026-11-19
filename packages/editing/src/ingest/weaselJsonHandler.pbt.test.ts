/**
 * The weasel clipboard paste as a fuzz target. Any app can put text on the clipboard that sniffs as the wire format,
 * so the handler pastes or declines on junk items and on a real copy with one field dropped, duplicated or retyped:
 * it never throws, never pollutes `Object.prototype`, and leaves a scene that saves and loads again.
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { asPolygonPath, rectPath } from '@weasel-js/geom';
import { createScene, sceneFromJSON } from '@weasel-js/core/engine';
import { sceneToAdapter, type IngestCtx, type NodeId } from '@weasel-js/core';
import { junk, mutate, mutated, prototypePolluted } from '@weasel-js/registry/testing/hostile.fixture';
import { buildWeaselClipboardText, parseWeaselClipboardText } from '../clipboard/wireFormat';
import { kitWeaselJsonHandler } from './weaselJsonHandler';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 200;
const TIMEOUT = Math.max(5_000, RUNS * 20);

type Pose = { x: number; y: number; width: number; height: number };

function canvas() {
  const scene = createScene<Record<string, unknown>, 'bg' | 'fg', Pose>({ systemLayers: [{ id: 'bg' }, { id: 'fg' }] });
  let selection: string[] = [];
  const adapter = sceneToAdapter(scene, { selection: { get: () => selection, set: (ids) => { selection = [...ids]; } } });
  return { scene, adapter, select: (ids: string[]) => { selection = ids; } };
}

/** A copy of a group holding two marks, and a mark on another layer, as the payload's JSON. */
function copiedPayload(): unknown {
  const { scene, adapter } = canvas();
  const g = scene.add({ kind: 'group', layer: 'bg', pose: { x: 10, y: 10, width: 50, height: 50 }, data: { name: 'g' } });
  scene.add({ kind: 'mark', layer: 'bg', parent: g, pose: { x: 1, y: 1, width: 5, height: 5 }, data: { path: asPolygonPath(rectPath(0, 0, 5, 5)) } });
  scene.add({ kind: 'mark', layer: 'bg', parent: g, pose: { x: 9, y: 9, width: 5, height: 5 }, data: { fill: '#f00' } });
  const m = scene.add({ kind: 'mark', layer: 'fg', pose: { x: 70, y: 0, width: 5, height: 5 }, data: {} });
  return JSON.parse(buildWeaselClipboardText(adapter.snapshotSelection!([g, m]).items)) as unknown;
}

const VALID = copiedPayload();

/** Pastes `text` into a fresh canvas the way an OS paste arrives. */
function paste(text: string) {
  const { scene, adapter } = canvas();
  const ctx = {
    point: null,
    clipboard: { adapter },
    operands: { get: () => [] as NodeId[], set: () => {} },
    applyOps: (ops: Parameters<IngestCtx['applyOps']>[0], label?: string) => adapter.applyOps!(ops, label),
  } as unknown as IngestCtx;
  kitWeaselJsonHandler.handle([{ kind: 'string', mime: 'text/plain', text }], ctx);
  return scene;
}

/** The paste either declined or added nodes, and the scene is one that saves and loads. */
function pastes(text: string): 'pasted' | 'declined' {
  const scene = paste(text);
  expect(prototypePolluted()).toBe(false);
  sceneFromJSON(JSON.parse(JSON.stringify(scene.toJSON())));
  return scene.nodes.size > 0 ? 'pasted' : 'declined';
}

describe('the weasel clipboard paste as a fuzz target', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('pastes a real copy', () => {
    expect(pastes(JSON.stringify(VALID))).toBe('pasted');
  });

  it('declines or pastes junk items, never throwing', () => {
    fc.assert(fc.property(fc.array(junk, { maxLength: 4 }), (items) => {
      pastes(JSON.stringify({ weaselClipboard: 1, nodes: items }));
    }), { numRuns: RUNS });
  }, TIMEOUT);

  it('declines or pastes a real copy with one field dropped, duplicated or retyped', () => {
    const seen = new Map<string, number>();
    fc.assert(fc.property(mutated(fc.constant(VALID)), ({ value }) => {
      const got = pastes(JSON.stringify(value) ?? '');
      seen.set(got, (seen.get(got) ?? 0) + 1);
    }), { numRuns: RUNS * 3 });
    expect(seen.get('pasted') ?? 0).toBeGreaterThan(RUNS / 4);
  }, TIMEOUT * 3);

  it('reads any text as items or null', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.json(), fc.json().map((j) => `{"weaselClipboard":1,"nodes":[${j}]}`)), (text) => {
      const got = parseWeaselClipboardText(text);
      expect(got === null || Array.isArray(got)).toBe(true);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('the weasel clipboard paste, shrunk counterexamples', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const pasted = (value: unknown) => paste(JSON.stringify(value)).nodes.size;
  const firstPose = ['nodes', 0, 'pose'];

  it('declines a null item rather than throwing a TypeError', () => {
    expect(pasted({ weaselClipboard: 1, nodes: [null] })).toBe(0);
  });

  it('declines an item whose pose has a list for its height, which would leave a scene that does not load', () => {
    expect(pasted(mutate(VALID, [...firstPose, 'height'], { op: 'duplicate' }))).toBe(0);
  });

  it("declines an item whose pose the descriptor throws reading, rather than throwing", () => {
    expect(pasted(mutate(VALID, [...firstPose, 'width'], { op: 'retype', to: { toString: false } }))).toBe(0);
  });

  it('declines items whose parents form a loop rather than overflowing the stack', () => {
    const loop = mutate(VALID, ['nodes', 0, 'parent'], { op: 'retype', to: (VALID as { nodes: { id: string }[] }).nodes[1]!.id });
    expect(pasted(loop)).toBe(0);
  });
});
