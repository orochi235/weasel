import {
  asNodeId,
  createScene,
  type Scene,
  type SerializedScene,
  sceneFromJSON,
} from '@weasel-js/core';
import { captureTarget } from './capture';
import type { WorldRect } from './frac';
import { fracContains, fracIntersects, fracToWorld, roundFrac, worldToFrac } from './frac';
import { MarkHistory } from './history';
import { isStale as isStaleAgainst, seenFrom } from './staleness';
import type {
  Annotation,
  AnnotationData,
  AnnotationInit,
  AnnotationMeaning,
  AnnotationPatch,
  AnnotationQuery,
  AnnotationsApi,
  AnnotationTargetInfo,
  CaptureOptions,
  CaptureResult,
  FracPoint,
  FracRect,
  SerializedAnnotations,
} from './types';

/** A mark's box in its target's world. Matches weasel's default `RectPose`. */
type MarkPose = WorldRect;

/** The scene one target's marks live in. */
export type MarkScene = Scene<AnnotationData, 'marks', MarkPose>;

/** A mark scene: one layer, because marks do not stack in tiers. */
export function createAnnotationScene(): MarkScene {
  return createScene<AnnotationData, 'marks', MarkPose>({ systemLayers: [{ id: 'marks' }] });
}

export interface AnnotationStoreOptions {
  /** Re-read on every call, so a target resizing or gaining a dependency takes
   *  effect without rebuilding the store. */
  targets: () => readonly AnnotationTargetInfo[];
  /** Serialized scenes from a previous `toJSON`, keyed by target. */
  restore?: Readonly<Record<string, unknown>>;
  /** The instrument's vocabulary, so an export draws a mark in the colour its
   *  status gives it. */
  meaning?: AnnotationMeaning;
  /** The trial's live config. A getter for the same reason `targets` is: the
   *  store is built once and the config changes under it. */
  config?: () => unknown;
  /** Notified after every finished export. */
  onCapture?: (result: CaptureResult) => void;
}

/** Everything a capture needs that is not the store's own state. Split out so
 *  `capture.ts` takes data rather than reaching back into the store. */
export interface CaptureDeps {
  scene: MarkScene;
  target: AnnotationTargetInfo;
  meaning?: AnnotationMeaning;
  config: unknown;
}

const NO_CONTENT = { w: 0, h: 0 };

/** A mark's id is its target and its node. One scene per target, so a node id
 *  is only unique within one — and an annotation is addressed by both. */
function splitId(id: string): { target: string; node: string } | undefined {
  const at = id.lastIndexOf('/');
  return at <= 0 ? undefined : { target: id.slice(0, at), node: id.slice(at + 1) };
}

/**
 * A facade over one weasel scene per target: the scenes are the truth, this
 * answers questions about them. Everything crossing this boundary is in
 * fractions of a target's content box; the scenes hold world units.
 *
 * A scene per target rather than one scene with a `target` field, because a
 * pane's hit-test, marquee and paint all walk the whole scene it is given and
 * take no filter — one shared scene puts every other pane's marks under the
 * pointer.
 */
export function createAnnotationStore(opts: AnnotationStoreOptions): AnnotationsApi {
  const { targets, restore } = opts;
  const scenes = new Map<string, MarkScene>();
  const subs = new Set<() => void>();
  const history = new MarkHistory();
  const notify = (): void => {
    for (const fn of subs) fn();
  };

  const sceneFor = (target: string): MarkScene => {
    const known = scenes.get(target);
    if (known) return known;
    const raw = restore?.[target];
    const scene = raw
      ? sceneFromJSON<AnnotationData, 'marks', MarkPose>(
          raw as SerializedScene<AnnotationData, 'marks', MarkPose>,
          {},
        )
      : createAnnotationScene();
    scenes.set(target, scene);
    history.track(target, scene);
    scene.subscribe(() => {
      history.observe(target, scene);
      notify();
    });
    return scene;
  };

  /** Only for scenes that exist: asking for one would create it, and the
   *  ordering never names a target it has not seen. */
  const historySceneAt = (target: string) => scenes.get(target);

  // Restored scenes are materialized up front: everything below reads
  // `scenes`, and a mark that only appears once its pane asks for its scene is
  // a mark a sidebar cannot list.
  for (const target of Object.keys(restore ?? {})) sceneFor(target);

  const targetOf = (id: string): AnnotationTargetInfo | undefined =>
    targets().find((t) => t.id === id);

  const contentOf = (id: string) => targetOf(id)?.content ?? NO_CONTENT;

  const project = (target: string, node: string): Annotation | undefined => {
    const found = scenes.get(target)?.get(asNodeId(node));
    if (!found) return undefined;
    return {
      ...found.data,
      target,
      id: `${target}/${node}`,
      frac: roundFrac(worldToFrac(found.pose as MarkPose, contentOf(target))),
    };
  };

  /** Every target with a scene, in declaration order — then any whose target
   *  the instrument has since stopped declaring, so its marks are not lost. */
  const liveTargets = (): string[] => {
    const declared = targets().map((t) => t.id);
    const rest = [...scenes.keys()].filter((id) => !declared.includes(id));
    return [...declared, ...rest];
  };

  const marksOn = (target: string): Annotation[] => {
    const scene = scenes.get(target);
    if (!scene) return [];
    const out: Annotation[] = [];
    for (const id of scene.renderOrder()) {
      const a = project(target, String(id));
      if (a) out.push(a);
    }
    return out;
  };

  const all = (): Annotation[] => liveTargets().flatMap(marksOn);

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

  /** The node behind a public id, or undefined. */
  const nodeOf = (id: string) => {
    const parts = splitId(id);
    if (!parts) return undefined;
    const scene = scenes.get(parts.target);
    const node = scene?.get(asNodeId(parts.node));
    return node && scene ? { ...parts, scene, node } : undefined;
  };

  return {
    sceneFor,

    targets,

    get(id) {
      const parts = splitId(id);
      return parts ? project(parts.target, parts.node) : undefined;
    },

    query(q) {
      return q ? all().filter((a) => matches(a, q)) : all();
    },

    hitTest(target, pt: FracPoint, tol = 0) {
      return marksOn(target)
        .filter((a) => fracContains(a.frac, pt, tol))
        .reverse();
    },

    within(target, box: FracRect) {
      return marksOn(target).filter((a) => fracIntersects(box, a.frac));
    },

    isStale(a, config) {
      const keys = targetOf(a.target)?.positionDependsOn ?? [];
      return isStaleAgainst(a.seen, config, keys);
    },

    canUndo() {
      return history.canUndo(historySceneAt);
    },

    canRedo() {
      return history.canRedo(historySceneAt);
    },

    undo() {
      return history.undo(historySceneAt);
    },

    redo() {
      return history.redo(historySceneAt);
    },

    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },

    add(init: AnnotationInit, config?: unknown) {
      const target = targetOf(init.target);
      const data: AnnotationData = {
        target: init.target,
        kind: init.kind,
        ...(init.points ? { points: init.points } : {}),
        ...(init.title !== undefined ? { title: init.title } : {}),
        ...(init.status !== undefined ? { status: init.status } : {}),
        ...(init.tags !== undefined ? { tags: init.tags } : {}),
        ...(init.meta !== undefined ? { meta: init.meta } : {}),
        seen: seenFrom(config, target?.positionDependsOn ?? []),
      };
      const node = sceneFor(init.target).add({
        kind: 'leaf',
        layer: 'marks',
        pose: fracToWorld(roundFrac(init.frac), target?.content ?? NO_CONTENT),
        data,
      });
      return `${init.target}/${String(node)}`;
    },

    update(id, patch: AnnotationPatch) {
      const found = nodeOf(id);
      if (!found) return;
      const { frac, ...meaning } = patch;
      const nid = asNodeId(found.node.id);
      if (Object.keys(meaning).length > 0) {
        found.scene.update(nid, { data: { ...found.node.data, ...meaning } });
      }
      if (frac) {
        found.scene.setPose(nid, fracToWorld(roundFrac(frac), contentOf(found.target)));
      }
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

    async capture(target: string, captureOpts?: CaptureOptions) {
      const info = targetOf(target);
      if (!info) throw new Error(`[labkit] no annotation target called '${target}'`);
      const result = await captureTarget(
        {
          target,
          scene: sceneFor(target),
          draw: {
            content: info.content,
            positionDependsOn: info.positionDependsOn,
            config: opts.config?.(),
            meaning: opts.meaning,
          },
          base: info.base,
          onWarn: (message) => console.warn(`[labkit] capture: ${message}`),
        },
        captureOpts,
      );
      opts.onCapture?.(result);
      return result;
    },

    toJSON(): SerializedAnnotations {
      const out: Record<string, unknown> = {};
      for (const [target, scene] of scenes) out[target] = scene.toJSON();
      return { version: 1, scenes: out };
    },
  };
}

/** Rebuild a store from what `toJSON` wrote. Unknown or future versions give
 *  an empty store rather than throwing: a lab that cannot read its marks
 *  should still open. */
export function annotationsFromJSON(
  raw: unknown,
  targets: () => readonly AnnotationTargetInfo[],
  rest: Omit<AnnotationStoreOptions, 'targets' | 'restore'> = {},
): AnnotationsApi {
  const doc = raw as Partial<SerializedAnnotations> | null;
  if (doc?.version !== 1 || !doc.scenes) return createAnnotationStore({ targets, ...rest });
  return createAnnotationStore({ targets, restore: doc.scenes, ...rest });
}
