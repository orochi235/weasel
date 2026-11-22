import { asNodeId } from '@weasel-js/core';
import { boundsOf, fracToWorld, worldToFrac } from './frac';
import { markDataFrom } from './markData';
import { markIdOf } from './markId';
import type { FoundMark } from './markReads';
import type { MarkPose, MarkScene } from './markScenes';
import { settledMarkData, shapeFor } from './markShape';
import { seenValues } from './staleness';
import type { AnnotationsApi, AnnotationTargetInfo } from './types';

/** What the write side needs: a way to reach each scene and each target. */
export interface MarkWritesOptions {
  scenes: ReadonlyMap<string, MarkScene>;
  openScene: (target: string) => MarkScene;
  hold: (fn: () => void) => void;
  /** Runs `fn`, whose changes on every target join the others made under `key` as one undo step. */
  grouped: (key: string, fn: () => void) => void;
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
  const { nodeOf } = o;
  /** A target's content box, to place a mark in. One with no area would put every mark at the origin. */
  const contentOf = (target: string) => {
    const content = o.contentOf(target);
    if (content.width > 0 && content.height > 0) return content;
    throw new Error(
      `[labkit] cannot place a mark on '${target}': its content box is not known, or has no area`,
    );
  };
  return {
    add(init, config) {
      const target = o.targetOf(init.target);
      // Unrounded: the scene holds world units, and 4dp of a long target's side is whole units. Reads round.
      const frac = init.frac;
      const shape = shapeFor(init.kind, init.points, frac);
      const data = markDataFrom(init, shape, seenValues(config, target?.positionDependsOn ?? []));
      // Placed before the scene opens, so a target with no content box throws without leaving an empty scene.
      const pose = fracToWorld(frac, contentOf(init.target));
      const node = o.openScene(init.target).add({ kind: 'mark', layer: 'marks', pose, data });
      return markIdOf(init.target, node);
    },

    update(id, patch, opts) {
      const found = nodeOf(id);
      if (!found) return;
      const { frac: fracPatch, points, ...meaning } = patch;
      const nid = asNodeId(found.node.id);
      const frac = fracPatch ?? (points ? boundsOf(points) : null);
      // Only a move needs the content box: a title or a color lands whatever the target's size.
      const content = frac ? contentOf(found.target) : o.contentOf(found.target);
      const bounds = frac ?? worldToFrac(found.node.pose as MarkPose, content);
      const shape = points ? shapeFor(found.node.data.kind, points, bounds) : undefined;
      // A legacy mark is written back settled, so its vertices follow the bounds from here on.
      const settled = settledMarkData(found.node.data, found.node.pose as MarkPose, content);
      const data = { ...settled, ...meaning, ...(shape ? { shape } : {}) };
      const key = opts?.coalesceKey;
      const write = (): void =>
        found.scene.batch(
          'update mark',
          () => {
            if (Object.keys(meaning).length > 0 || shape || settled !== found.node.data)
              found.scene.update(nid, { data });
            if (frac) found.scene.setPose(nid, fracToWorld(bounds, content));
          },
          key === undefined ? undefined : { coalesceKey: key },
        );
      // The key folds updates within one target's scene; the group joins the targets' parts as one step.
      if (key === undefined) write();
      else o.grouped(key, write);
    },

    setMeta(id, meta) {
      const found = nodeOf(id);
      if (!found) return;
      const settled = settledMarkData(
        found.node.data,
        found.node.pose as MarkPose,
        o.contentOf(found.target),
      );
      found.scene.update(asNodeId(found.node.id), { data: { ...settled, meta } });
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
