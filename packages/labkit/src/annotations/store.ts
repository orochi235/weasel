import {
  asNodeId,
  createScene,
  type Scene,
  type SerializedScene,
  sceneFromJSON,
} from '@weasel-js/core';
import type { WorldRect } from './frac';
import { fracContains, fracIntersects, fracToWorld, roundFrac, worldToFrac } from './frac';
import { isStale as isStaleAgainst, seenFrom } from './staleness';
import type {
  Annotation,
  AnnotationData,
  AnnotationInit,
  AnnotationPatch,
  AnnotationQuery,
  AnnotationsApi,
  AnnotationTargetInfo,
  FracPoint,
  FracRect,
  SerializedAnnotations,
} from './types';

/** A mark's box in its target's world. Matches weasel's default `RectPose`. */
type MarkPose = WorldRect;

/** The scene a trial's marks live in. Its pose is the mark's box in the
 *  target's world; its data is what the mark is. */
export type MarkScene = Scene<AnnotationData, 'marks', MarkPose>;

/** The scene marks live in. One layer: marks do not stack in tiers, and a
 *  target's separation is a field, not a layer — a layer per target would
 *  rebuild the scene every time an instrument's target list changed. */
export function createAnnotationScene(): MarkScene {
  return createScene<AnnotationData, 'marks', MarkPose>({ systemLayers: [{ id: 'marks' }] });
}

export interface AnnotationStoreOptions {
  scene: MarkScene;
  /** Re-read on every call, so a target resizing or gaining a dependency takes
   *  effect without rebuilding the store. */
  targets: () => readonly AnnotationTargetInfo[];
}

const NO_CONTENT = { w: 0, h: 0 };

/**
 * A facade over a weasel scene: the scene is the truth, this answers questions
 * about it. Everything crossing this boundary is in fractions of a target's
 * content box; the scene holds world units.
 */
export function createAnnotationStore(opts: AnnotationStoreOptions): AnnotationsApi {
  const { scene, targets } = opts;

  const targetOf = (id: string): AnnotationTargetInfo | undefined =>
    targets().find((t) => t.id === id);

  const project = (id: string): Annotation | undefined => {
    const node = scene.get(asNodeId(id));
    if (!node) return undefined;
    const data = node.data;
    const content = targetOf(data.target)?.content ?? NO_CONTENT;
    return {
      ...data,
      id,
      frac: roundFrac(worldToFrac(node.pose as MarkPose, content)),
    };
  };

  const all = (): Annotation[] => {
    const out: Annotation[] = [];
    for (const id of scene.renderOrder()) {
      const a = project(String(id));
      if (a) out.push(a);
    }
    return out;
  };

  const matches = (a: Annotation, q: AnnotationQuery): boolean => {
    if (q.target !== undefined && a.target !== q.target) return false;
    if (q.kind !== undefined && a.kind !== q.kind) return false;
    if (q.status !== undefined && a.status !== q.status) return false;
    if (q.tags !== undefined) {
      const have = a.tags ?? [];
      for (const t of q.tags) if (!have.includes(t)) return false;
    }
    if (q.where && !q.where(a)) return false;
    return true;
  };

  return {
    get: project,

    query(q) {
      return q ? all().filter((a) => matches(a, q)) : all();
    },

    hitTest(target, pt: FracPoint, tol = 0) {
      return all()
        .filter((a) => a.target === target && fracContains(a.frac, pt, tol))
        .reverse();
    },

    within(target, box: FracRect) {
      return all().filter((a) => a.target === target && fracIntersects(box, a.frac));
    },

    isStale(a, config) {
      const keys = targetOf(a.target)?.positionDependsOn ?? [];
      return isStaleAgainst(a.seen, config, keys);
    },

    subscribe(fn) {
      return scene.subscribe(fn);
    },

    add(init: AnnotationInit, config?: unknown) {
      const target = targetOf(init.target);
      const keys = target?.positionDependsOn ?? [];
      const data: AnnotationData = {
        target: init.target,
        kind: init.kind,
        ...(init.points ? { points: init.points } : {}),
        ...(init.title !== undefined ? { title: init.title } : {}),
        ...(init.status !== undefined ? { status: init.status } : {}),
        ...(init.tags !== undefined ? { tags: init.tags } : {}),
        ...(init.meta !== undefined ? { meta: init.meta } : {}),
        seen: seenFrom(config, keys),
      };
      return String(
        scene.add({
          kind: 'leaf',
          layer: 'marks',
          pose: fracToWorld(roundFrac(init.frac), target?.content ?? NO_CONTENT),
          data,
        }),
      );
    },

    update(id, patch: AnnotationPatch) {
      const node = scene.get(asNodeId(id));
      if (!node) return;
      const { frac, ...meaning } = patch;
      if (Object.keys(meaning).length > 0) {
        scene.update(asNodeId(id), { data: { ...node.data, ...meaning } });
      }
      if (frac) {
        const content = targetOf(node.data.target)?.content ?? NO_CONTENT;
        scene.setPose(asNodeId(id), fracToWorld(roundFrac(frac), content));
      }
    },

    setMeta(id, meta) {
      const node = scene.get(asNodeId(id));
      if (!node) return;
      scene.update(asNodeId(id), { data: { ...node.data, meta } });
    },

    remove(id) {
      const nid = asNodeId(id);
      if (scene.get(nid)) scene.remove(nid);
    },

    toJSON(): SerializedAnnotations {
      return { version: 1, scene: scene.toJSON() };
    },
  };
}

/** Rebuild a store from what `toJSON` wrote. Unknown or future versions give
 *  an empty store rather than throwing: a lab that cannot read its marks
 *  should still open. */
export function annotationsFromJSON(
  raw: unknown,
  targets: () => readonly AnnotationTargetInfo[],
): AnnotationsApi {
  const doc = raw as Partial<SerializedAnnotations> | null;
  if (doc?.version !== 1 || !doc.scene) {
    return createAnnotationStore({ scene: createAnnotationScene(), targets });
  }
  const scene = sceneFromJSON<AnnotationData, 'marks', MarkPose>(
    doc.scene as SerializedScene<AnnotationData, 'marks', MarkPose>,
    {},
  );
  return createAnnotationStore({ scene, targets });
}
