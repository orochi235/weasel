import type { Scene, TransformFollower, TransformPreviewNode } from '@weasel-js/core';
import { diagramEdgeOf } from '../edgeTrait';
import { inOrUnder, sceneEdges, withHopsData, type AnyScene } from './sceneEdges';

/**
 * The transform follower that hides hops while a drag is in progress: each
 * frame previews the connectors it moves, and every connector hopping over
 * one, without their hops. A hop stays where the edit pass put it, so it
 * would sit off a moving route; on release the pass recomputes them in the
 * drag's entry. Register it after any follower that reroutes connectors, whose
 * previewed data it keeps.
 */
export function hopFollower<TPose>(scene: Scene<unknown, string, TPose>): TransformFollower {
  const sc = scene as unknown as AnyScene;
  return {
    preview(frame, data) {
      if (frame.size === 0) return [];
      const edges = sceneEdges(sc);
      const moved = new Set<string>();
      for (const e of edges) {
        if (frame.has(e.node.id) || e.ends.some((end) => inOrUnder(sc, end, frame))) moved.add(e.node.id);
      }
      const out: TransformPreviewNode[] = [];
      for (const e of edges) {
        const hops = e.trait.hops;
        if (hops === undefined || hops.length === 0) continue;
        if (!moved.has(e.node.id) && !hops.some((h) => h.over.some((id) => moved.has(id)))) continue;
        const shown = data.get(e.node.id) ?? e.node.data;
        const trait = diagramEdgeOf({ data: shown }) ?? e.trait;
        out.push({ id: e.node.id, pose: e.node.pose, data: withHopsData(shown, trait, []) });
      }
      return out;
    },
    finish: (ops) => [...ops],
  };
}
