/** What an animated element reaches among the drafts of one import, and where each draft now lies in the scene. */
import type { NodeId } from '@weasel-js/core';
import type { Affine } from '@weasel-js/geom';
import type { SvgSceneDraft } from './unpack';
import type { SvgClipScene } from './smilGeometry';

export interface DraftTree {
  /** The draft lowered from the element with id `source`. */
  bySource(source: string): SvgSceneDraft<unknown> | undefined;
  /** `top` and every draft under it, parents first, stopping below a draft `descend` refuses. */
  under(top: string, descend?: (d: SvgSceneDraft<unknown>) => boolean): SvgSceneDraft<unknown>[];
  /** How many drafts `id` sits under. */
  depthOf(id: string): number;
  /** The map from where draft `id` was drafted, the document's coordinates, to where its node now is:
   *  an import moves and scales an import's boxes alike, so the map is a uniform scale and a move. */
  frameOf(id: string): Affine | null;
}

export function createDraftTree(scene: SvgClipScene, drafts: readonly SvgSceneDraft<unknown>[]): DraftTree {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const sources = new Map<string, SvgSceneDraft<unknown>>();
  for (const d of drafts) if (d.source !== undefined && !sources.has(d.source)) sources.set(d.source, d);
  const children = new Map<string, SvgSceneDraft<unknown>[]>();
  for (const d of drafts) if (d.parentId !== null) (children.get(d.parentId) ?? children.set(d.parentId, []).get(d.parentId)!).push(d);
  return {
    bySource: (source) => sources.get(source),
    under(top, descend = () => true) {
      const first = byId.get(top);
      if (!first) return [];
      const out = [first];
      for (let i = 0; i < out.length; i++) for (const c of children.get(out[i].id) ?? []) if (descend(c)) out.push(c);
      return out;
    },
    depthOf(id) {
      let depth = 0;
      for (let d = byId.get(id); d?.parentId != null; d = byId.get(d.parentId)) depth++;
      return depth;
    },
    frameOf(id) {
      const from = byId.get(id)?.pose;
      const to = scene.get(id as NodeId)?.pose;
      if (!from || !to) return null;
      const s = from.width > 0 ? to.width / from.width : from.height > 0 ? to.height / from.height : 1;
      return [s, 0, 0, s, to.x - from.x * s, to.y - from.y * s];
    },
  };
}
