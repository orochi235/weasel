import type { DataContainer } from '../dataTypes';
import { edgeIdOf, type DataEdge } from '../fromData';
import { drawableWires, type EffectLookResult } from './draw';
import { ensureWireIds } from './edit';
import { lanes, type LanesOptions } from './lanes';
import { nodeGraph, type NodeGraphOptions } from './nodeGraph';
import { rack, type RackOptions } from './rack';
import type { EffectDoc, EffectWire } from './types';

/** The looks an editor draws a doc in. */
export type EditorLook = 'nodeGraph' | 'rack' | 'lanes';

/** Each editor look's options. Rack's `chain` is left out: a reorder follows
 *  the wiring, and a chain given here would draw some other order. */
export interface EditorLookOptions {
  nodeGraph: NodeGraphOptions;
  rack: Omit<RackOptions, 'chain'>;
  lanes: LanesOptions;
}

/** A look's drawing of a doc, and the way back from what the drawing reports
 *  to the doc. A port id needs no mapping: box stages and decision symbols
 *  both give each port its `EffectPort` id. */
export interface EditorScene extends EffectLookResult {
  /** The stage a scene node is, or `undefined` for a group box, a lane, or anything else. */
  stageOf(node: string): string | undefined;
  /** The group a scene node is: a container under `nodeGraph`, a group box under the others. */
  groupOf(node: string): string | undefined;
  /** The wire a data edge id (`edgeIdOf`) draws, by its id in
   *  `ensureWireIds(doc)`, so an id-less wire is found by the id it will get.
   *  `undefined` for an edge standing in for more than one wire, such as
   *  rack's arc over a skip. */
  wireOf(edge: string): string | undefined;
}

const endsKey = (from: EffectWire['from'], to: EffectWire['to']) => JSON.stringify([from.stage, from.port, to.stage, to.port]);
const edgeEnds = (e: DataEdge) => endsKey({ stage: e.from, port: e.fromPort ?? '' }, { stage: e.to, port: e.toPort ?? '' });

/** The look's drawing of the doc's pipeline. Under `nodeGraph` every placed
 *  stage is pinned at its place, so layered layout places only the stages
 *  that have none, and each group is a container, at its `groupBoxes` box or
 *  fitting its members; the other looks place every stage themselves and draw
 *  groups as boxes around their members. `lanes` takes the doc's `laneOrder`
 *  over its options' `lanes`. */
export function editorScene<L extends EditorLook = 'nodeGraph'>(
  doc: EffectDoc,
  look: L = 'nodeGraph' as L,
  options?: EditorLookOptions[L],
): EditorScene {
  const drawn = drawLook(doc, look, options);
  const stages = new Set(doc.pipeline.stages.map((s) => s.id));
  const groups = new Set((doc.pipeline.groups ?? []).map((g) => g.id));
  const ids = ensureWireIds(doc).pipeline.wires.map((w) => w.id!);
  const byEnds = new Map<string, string>();
  for (const d of drawableWires(doc.pipeline)) {
    const key = endsKey(d.wire.from, d.wire.to);
    if (!byEnds.has(key)) byEnds.set(key, ids[d.index]!);
  }
  const wires = new Map(drawn.data.edges.flatMap((e) => {
    const id = byEnds.get(edgeEnds(e));
    return id === undefined ? [] : [[edgeIdOf(e), id] as const];
  }));
  // Only `nodeGraph` draws hand-set routes; `rack` and `lanes` route their own wires.
  const routes = look === 'nodeGraph' ? doc.routes : undefined;
  const edges = routes === undefined ? drawn.data.edges : drawn.data.edges.map((e) => {
    const id = wires.get(edgeIdOf(e));
    const route = id === undefined ? undefined : routes[id];
    return route === undefined ? e : { ...e, waypoints: route };
  });
  return {
    ...drawn,
    data: { ...drawn.data, edges },
    stageOf: (node) => (stages.has(node) ? node : undefined),
    groupOf: (node) => (groups.has(node) && !stages.has(node) ? node : undefined),
    wireOf: (edge) => wires.get(edge),
  };
}

function drawLook(doc: EffectDoc, look: EditorLook, options: EditorLookOptions[EditorLook] | undefined): EffectLookResult {
  if (look === 'rack') return rack(doc.pipeline, options as EditorLookOptions['rack'] | undefined);
  if (look === 'lanes') {
    const opts = options as LanesOptions | undefined;
    const order = doc.laneOrder ?? opts?.lanes;
    return lanes(doc.pipeline, { ...opts, ...(order !== undefined ? { lanes: order } : {}) });
  }
  const drawn = nodeGraph(doc.pipeline, options as NodeGraphOptions | undefined);
  const nodes = drawn.data.nodes.map((n) => {
    const at = doc.places[n.id];
    return at === undefined ? n : { ...n, at: { x: at.x, y: at.y }, pinned: true };
  });
  const { groups = [], ...rest } = drawn.data;
  const containers = groups.map((g): DataContainer => {
    const box = doc.groupBoxes?.[g.id];
    return {
      id: g.id, role: 'container', label: g.label ?? '', members: g.members,
      ...(box !== undefined ? { box: { ...box }, pinned: true } : {}),
    };
  });
  return { ...drawn, data: { ...rest, nodes, ...(containers.length > 0 ? { containers } : {}) } };
}
