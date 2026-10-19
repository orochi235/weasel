import { edgeIdOf } from '../fromData';
import { drawableWires, type EffectLookResult } from './draw';
import { ensureWireIds } from './edit';
import { nodeGraph, type NodeGraphOptions } from './nodeGraph';
import type { EffectDoc } from './types';

/** `nodeGraph`'s drawing of a doc, and the way back from what the drawing
 *  reports to the doc. A port id needs no mapping: box stages and decision
 *  symbols both give each port its `EffectPort` id. */
export interface EditorScene extends EffectLookResult {
  /** The stage a scene node is, or `undefined` for a group box or anything else. */
  stageOf(node: string): string | undefined;
  /** The wire a data edge id (`edgeIdOf`) draws, by its id in
   *  `ensureWireIds(doc)`, so an id-less wire is found by the id it will get. */
  wireOf(edge: string): string | undefined;
}

/** `nodeGraph` over the doc's pipeline, with every placed stage pinned at its
 *  place, so layered layout places only the stages that have none. */
export function editorScene(doc: EffectDoc, options?: NodeGraphOptions): EditorScene {
  const drawn = nodeGraph(doc.pipeline, options);
  const nodes = drawn.data.nodes.map((n) => {
    const at = doc.places[n.id];
    return at === undefined ? n : { ...n, at: { x: at.x, y: at.y }, pinned: true };
  });
  const stages = new Set(doc.pipeline.stages.map((s) => s.id));
  const ids = ensureWireIds(doc).pipeline.wires.map((w) => w.id!);
  // `nodeGraph` draws one edge per drawable wire, in the same order.
  const wires = new Map(drawableWires(doc.pipeline).map((d, i) => [edgeIdOf(drawn.data.edges[i]!), ids[d.index]!]));
  return {
    ...drawn,
    data: { ...drawn.data, nodes },
    stageOf: (node) => (stages.has(node) ? node : undefined),
    wireOf: (edge) => wires.get(edge),
  };
}
