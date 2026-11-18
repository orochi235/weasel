import { asNodeId } from '@weasel-js/core';
import { boundsOf, fracToWorld, roundFrac, worldToFrac } from './frac';
import { markDataFrom } from './markData';
import { markIdOf } from './markId';
import type { FoundMark } from './markReads';
import type { MarkPose, MarkScene } from './markScenes';
import { shapeFor } from './markShape';
import { seenValues } from './staleness';
import type { AnnotationsApi, AnnotationTargetInfo } from './types';

/** What the write side needs: a way to reach each scene and each target. */
export interface MarkWritesOptions {
  scenes: ReadonlyMap<string, MarkScene>;
  openScene: (target: string) => MarkScene;
  hold: (fn: () => void) => void;
  nodeOf: (id: string) => FoundMark | undefined;
  targetOf: (id: string) => AnnotationTargetInfo | undefined;
  contentOf: (target: string) => { width: number; height: number };
  /** Whether a selection may stand in only one target. Read at each call. */
  exclusive: () => boolean;
}

export type MarkWrites = Pick<
  AnnotationsApi,
  'add' | 'update' | 'setMeta' | 'remove' | 'setSelection'
>;

/** The store's mutations: each converts fractions to world units and lands as
 *  scene ops, so every one is undoable through the scene's own history. */
export function createMarkWrites(o: MarkWritesOptions): MarkWrites {
  const { nodeOf, contentOf } = o;
  return {
    add(init, config) {
      const target = o.targetOf(init.target);
      const frac = roundFrac(init.frac);
      const shape = shapeFor(init.kind, init.points, frac);
      const data = markDataFrom(init, shape, seenValues(config, target?.positionDependsOn ?? []));
      const node = o.openScene(init.target).add({
        kind: 'mark',
        layer: 'marks',
        pose: fracToWorld(frac, contentOf(init.target)),
        data,
      });
      return markIdOf(init.target, node);
    },

    update(id, patch, opts) {
      const found = nodeOf(id);
      if (!found) return;
      const { frac: fracPatch, points, ...meaning } = patch;
      const nid = asNodeId(found.node.id);
      const content = contentOf(found.target);
      const frac = fracPatch ?? (points ? boundsOf(points) : null);
      const bounds = roundFrac(frac ?? worldToFrac(found.node.pose as MarkPose, content));
      const shape = points ? shapeFor(found.node.data.kind, points, bounds) : undefined;
      const data = { ...found.node.data, ...meaning, ...(shape ? { shape } : {}) };
      const coalesce =
        opts?.coalesceKey === undefined ? undefined : { coalesceKey: opts.coalesceKey };
      found.scene.batch(
        'update mark',
        () => {
          if (Object.keys(meaning).length > 0 || shape) found.scene.update(nid, { data });
          if (frac) found.scene.setPose(nid, fracToWorld(bounds, content));
        },
        coalesce,
      );
    },

    setMeta(id, meta) {
      const found = nodeOf(id);
      if (!found) return;
      found.scene.update(asNodeId(found.node.id), { data: { ...found.node.data, meta } });
    },

    remove(id) {
      const found = nodeOf(id);
      if (found) found.scene.remove(asNodeId(found.node.id));
    },

    setSelection(ids) {
      const wanted = new Map<string, string[]>();
      const only = o.exclusive();
      for (const id of ids) {
        const found = nodeOf(id);
        if (!found) continue;
        if (only && wanted.size > 0 && !wanted.has(found.target)) continue;
        const node = String(found.node.id);
        const on = wanted.get(found.target);
        if (!on) wanted.set(found.target, [node]);
        else if (!on.includes(node)) on.push(node);
      }
      o.hold(() => {
        for (const [target, scene] of o.scenes) {
          const next = wanted.get(target) ?? [];
          const now = scene.getSelection();
          if (now.length === next.length && next.every((n, i) => String(now[i]) === n)) continue;
          scene.setSelection(next.map(asNodeId));
        }
      });
    },
  };
}
