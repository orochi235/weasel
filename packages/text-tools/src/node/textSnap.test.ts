/** What a text node offers path snapping: its box, since its silhouette is line boxes, not a drawn outline. */
import { beforeEach, describe, expect, it } from 'vitest';
import { asNodeId, type Scene } from '@weasel-js/core';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'domains/snap/outcomeStore';
import { createSession2d } from 'domains/snap/session2d';
import { pathSnapSource, type PathSnapSourceOptions } from 'domains/paths/pathSnap/pathSnapSource';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

const FREE: SnapMods = { suspend: false, constrain: false };

function run(scene: Scene<unknown, string, unknown>, opts: PathSnapSourceOptions, at: { x: number; y: number }) {
  const s = createSession2d({
    req: { gesture: 'point', press: at } as SnapBegin,
    sources: [pathSnapSource(opts)],
    probes: [{ id: 'pointer', at, role: 'pointer' }],
    view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    reachPx: 8,
    scene,
    store: createSnapOutcomeStore(),
  });
  return s.at(at, FREE);
}

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('what a text node offers to snap to', () => {
  it("gives its box: its corners and its center", () => {
    const text = {
      nodes: new Map([[asNodeId('n'), {
        id: asNodeId('n'), kind: 'mark' as const, layer: 'default', parent: null,
        pose: { x: 0, y: 0, width: 100, height: 40 }, data: { text: 'hi' },
      }]]),
      layers: [{ id: 'default' }],
      getVersion: () => 1,
    } as unknown as Scene<unknown, string, unknown>;
    const only = { kinds: { nearest: false, midpoint: false } };
    expect(run(text, only, { x: 51, y: 21 }).marks).toEqual([{ kind: 'point', at: { x: 50, y: 20 }, glyph: 'center', label: 'center' }]);
    expect(run(text, only, { x: 98, y: 2 }).marks).toEqual([{ kind: 'point', at: { x: 100, y: 0 }, glyph: 'anchor', label: 'anchor' }]);
  });
});
