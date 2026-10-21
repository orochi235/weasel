import { describe, expect, it } from 'vitest';
import { diagramScene, type DiagramSpec } from '../fromData';
import { moveInChain } from './chainEdit';
import { removeStages, removeWires, setLaneOrder, setWireRoute } from './edit';
import { editorScene, type EditorLook } from './editorMapping';
import { applyLookRoutes, setLookRoute, wireEnds } from './lookRoutes';
import { io, w } from './skipFixture';
import type { EffectDoc } from './types';

/** A main line `a`, `b`, `c`, and `s` feeding `c` a mask from the side. */
const DOC: EffectDoc = {
  pipeline: {
    stages: [
      io('a', { inputs: [] }),
      io('b'),
      io('c', { inputs: [{ id: 'in', type: 'image' }, { id: 'aux', type: 'mask' }] }),
      { id: 's', title: 's', outputs: [{ id: 'out', type: 'mask' }] },
    ],
    wires: [
      { id: 'w1', ...w(['a', 'out'], ['b', 'in']) },
      { id: 'w2', ...w(['b', 'out'], ['c', 'in']) },
      { id: 'w3', ...w(['s', 'out'], ['c', 'aux']) },
    ],
  },
  places: {},
};

const BEND = [{ x: -500, y: -500 }];

function drawn(doc: EffectDoc, look: EditorLook) {
  const built = editorScene(doc, look);
  return { built, specs: applyLookRoutes(diagramScene(built.data, built.scene), doc, look, built) };
}

const edgeOf = (doc: EffectDoc, look: EditorLook, wire: string) => {
  const { built, specs } = drawn(doc, look);
  expect(built.wireOf(wire)).toBe(wire);
  return specs.find((s) => s.id === wire) as DiagramSpec & { data: { diagram: { waypoints?: unknown } } };
};

/** `doc` with `wire` routed through `BEND` under `look`, from where its ends are drawn now. */
function routed(doc: EffectDoc, look: 'rack' | 'lanes', wire: string): EffectDoc {
  return setLookRoute(doc, look, wire, BEND, wireEnds(drawn(doc, look).specs, wire)!);
}

describe.each(['rack', 'lanes'] as const)('look routes under %s', (look) => {
  it('draws a wire through its route while its ends are where they were', () => {
    const doc = routed(DOC, look, 'w3');
    expect(edgeOf(doc, look, 'w3').data.diagram.waypoints).toEqual(BEND);
    expect(edgeOf(doc, look, 'w2').data.diagram.waypoints).not.toEqual(BEND);
  });

  it('ignores the route once a reorder moves an end of the wire', () => {
    const doc = routed(DOC, look, 'w3');
    const moved = moveInChain(doc, 'c', 1)!;
    expect(wireEnds(drawn(moved, look).specs, 'w3')).not.toEqual(doc.lookRoutes![look]!.w3!.ends);
    expect(moved.lookRoutes?.[look]?.w3).toBeDefined();
    expect(edgeOf(moved, look, 'w3').data.diagram.waypoints).not.toEqual(BEND);
  });

  it('ignores the route once a deleted stage moves an end of the wire', () => {
    const doc = routed(DOC, look, 'w2');
    const gone = removeStages(doc, ['a']);
    expect(wireEnds(drawn(gone, look).specs, 'w2')).not.toEqual(wireEnds(drawn(doc, look).specs, 'w2'));
    expect(gone.lookRoutes?.[look]?.w2).toBeDefined();
    expect(edgeOf(gone, look, 'w2').data.diagram.waypoints).not.toEqual(BEND);
  });

  it('keeps the other look out of it', () => {
    const other = look === 'rack' ? 'lanes' : 'rack';
    const doc = routed(DOC, look, 'w3');
    expect(edgeOf(doc, other, 'w3').data.diagram.waypoints).not.toEqual(BEND);
    expect(edgeOf(doc, 'nodeGraph', 'w3').data.diagram.waypoints).toBeUndefined();
  });
});

describe('setLookRoute', () => {
  it('keeps the route and its ends under the look, and clears it given no waypoints', () => {
    const doc = setLookRoute(DOC, 'lanes', 'w1', BEND, [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(doc.lookRoutes).toEqual({ lanes: { w1: { waypoints: BEND, ends: [{ x: 1, y: 2 }, { x: 3, y: 4 }] } } });
    expect(setLookRoute(doc, 'lanes', 'w1', [], [{ x: 1, y: 2 }, { x: 3, y: 4 }]).lookRoutes).toBeUndefined();
  });
});

describe('pruning look routes', () => {
  const both = (doc: EffectDoc, wire: string) => setLookRoute(setLookRoute(doc, 'rack', wire, BEND, [BEND[0]!, BEND[0]!]), 'lanes', wire, BEND, [BEND[0]!, BEND[0]!]);

  it('drops a removed wire’s routes', () => {
    expect(removeWires(both(DOC, 'w3'), ['w3']).lookRoutes).toBeUndefined();
  });

  it('drops the routes of a removed stage’s wires', () => {
    const doc = removeStages(both(both(DOC, 'w3'), 'w1'), ['s']);
    expect(Object.keys(doc.lookRoutes!.rack!)).toEqual(['w1']);
    expect(Object.keys(doc.lookRoutes!.lanes!)).toEqual(['w1']);
  });

  it('drops the routes of the wires a reorder rewires, and keeps the rest', () => {
    const doc = moveInChain(both(both(DOC, 'w3'), 'w1'), 'c', 1)!;
    expect(doc.pipeline.wires.find((x) => x.id === 'w1')!.to.stage).toBe('c');
    expect(Object.keys(doc.lookRoutes!.rack!)).toEqual(['w3']);
  });

  it('keeps a dropped wire’s routes off the new wire a reorder mints under its id', () => {
    const doc = moveInChain(setWireRoute(both(DOC, 'w2'), 'w2', BEND), 'c', 1)!;
    expect(doc.pipeline.wires.find((x) => x.id === 'w2')).toMatchObject({ from: { stage: 'c' }, to: { stage: 'b' } });
    expect(doc.lookRoutes).toBeUndefined();
    expect(doc.routes).toEqual({});
  });

  it('leaves a lane reorder’s routes to their ends', () => {
    const doc = setLaneOrder(both(DOC, 'w3'), ['mask', 'image']);
    expect(doc.lookRoutes?.lanes?.w3).toBeDefined();
  });
});
