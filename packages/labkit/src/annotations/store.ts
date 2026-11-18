import { asNodeId } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import { setOwn } from '../config/path';
import { captureTarget } from './capture';
import { type MarkDrawOptions, resolveMarkStyle } from './drawOne';
import { fracContains, fracEncloses } from './frac';
import { MarkHistory, markHistoryOf, markUndo } from './history';
import { splitMarkId } from './markId';
import { createMarkReads } from './markReads';
import { createMarkScenes, type MarkPose, type MarkScene } from './markScenes';
import { createMarkWrites } from './markWrites';
import { matchesQuery } from './query';
import { isStale as isStaleAgainst } from './staleness';
import type {
  AnnotationData,
  AnnotationMeaning,
  AnnotationSelectionMode,
  AnnotationsApi,
  AnnotationTargetInfo,
  CaptureOptions,
  CaptureResult,
  FracPoint,
  FracRect,
  SerializedMarkStore,
} from './types';

export { createMarkScene, type MarkPose, type MarkScene } from './markScenes';

/** Inputs to `createMarkStore`. */
export interface AnnotationStoreOptions {
  /** Re-read on every call, so a target resizing or gaining a dependency takes
   *  effect without rebuilding the store. */
  targets: () => readonly AnnotationTargetInfo[];
  /** Serialized scenes from a previous `toJSON`, keyed by target. */
  restore?: Readonly<Record<string, unknown>>;
  /** The undo history the same `toJSON` wrote beside them. */
  history?: unknown;
  /** The instrument's vocabulary, so an export draws a mark in the color its
   *  status gives it. A thunk is read at each capture, for a vocabulary that
   *  changes under a store built once. */
  meaning?: AnnotationMeaning | (() => AnnotationMeaning | undefined);
  /** The trial's live config. A getter for the same reason `targets` is: the
   *  store is built once and the config changes under it. */
  config?: () => unknown;
  /** Notified after every finished export. */
  onCapture?: (result: CaptureResult) => void;
  /** Whether a selection can stand in several targets at once. `'exclusive'`
   *  (the default) clears every other target when a mark is selected in one.
   *  A thunk is read at each selection change. */
  selection?: AnnotationSelectionMode | (() => AnnotationSelectionMode | undefined);
}

/** Everything a capture needs that is not the store's own state. Split out so
 *  `capture.ts` takes data rather than reaching back into the store. */
export interface CaptureDeps {
  scene: MarkScene;
  target: AnnotationTargetInfo;
  meaning?: AnnotationMeaning;
  config: unknown;
}

const NO_CONTENT = { width: 0, height: 0 };

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
export function createMarkStore(opts: AnnotationStoreOptions): AnnotationsApi {
  const { targets } = opts;
  const subs = createEmitter();
  const history = new MarkHistory();

  const exclusive = (): boolean =>
    (typeof opts.selection === 'function' ? opts.selection() : opts.selection) !== 'per-target';
  const targetOf = (id: string): AnnotationTargetInfo | undefined =>
    targets().find((t) => t.id === id);
  const contentOf = (id: string) => targetOf(id)?.content ?? NO_CONTENT;

  const { scenes, openScene, hold } = createMarkScenes({
    restore: opts.restore,
    historyJSON: opts.history,
    history,
    contentOf,
    exclusive,
    notify: subs.emit,
  });
  history.fromJSON(opts.history);
  const reads = createMarkReads({ scenes, targets, contentOf });
  const { project, marksOn, all } = reads;

  /** How a target's marks are drawn right now — one answer for the pane, an
   *  export and an overview, so none can disagree on a color or a dash. */
  const drawOptionsFor = (info: AnnotationTargetInfo): MarkDrawOptions => ({
    content: info.content,
    positionDependsOn: info.positionDependsOn,
    config: opts.config?.(),
    meaning: typeof opts.meaning === 'function' ? opts.meaning() : opts.meaning,
  });

  return {
    openScene,

    targets,

    get(id) {
      const parts = splitMarkId(id);
      return parts ? project(parts.target, parts.node) : undefined;
    },

    query(q) {
      return q ? all().filter((a) => matchesQuery(a, q)) : all();
    },

    hitTest(target, pt: FracPoint, tol = 0) {
      return marksOn(target)
        .filter((a) => fracContains(a.frac, pt, tol))
        .reverse();
    },

    within(target, box: FracRect) {
      return marksOn(target).filter((a) => fracEncloses(box, a.frac));
    },

    isStale(a, config) {
      const keys = targetOf(a.target)?.positionDependsOn ?? [];
      return isStaleAgainst(a.seen, config, keys);
    },

    // Only scenes that exist: asking for one would create it, and the
    // ordering never names a target it has not seen.
    ...markUndo(history, (target) => scenes.get(target)),

    selection: reads.selection,

    subscribe: subs.subscribe,

    ...createMarkWrites({
      scenes,
      openScene,
      hold,
      nodeOf: reads.nodeOf,
      targetOf,
      contentOf,
      exclusive,
    }),

    paintedMarks(target) {
      const info = targetOf(target);
      const scene = scenes.get(target);
      if (!info || !scene) return [];
      const draw = drawOptionsFor(info);
      return [...scene.renderOrder()].flatMap((id) => {
        const node = scene.get(asNodeId(String(id)));
        if (!node) return [];
        const data = node.data as AnnotationData;
        return [
          { mark: { pose: node.pose as MarkPose, data }, style: resolveMarkStyle(data, draw) },
        ];
      });
    },

    async capture(target: string, captureOpts?: CaptureOptions) {
      const info = targetOf(target);
      if (!info) throw new Error(`[labkit] no annotation target called '${target}'`);
      const result = await captureTarget(
        {
          target,
          scene: openScene(target),
          draw: drawOptionsFor(info),
          base: info.base,
          onWarn: (message) => console.warn(`[labkit] capture: ${message}`),
        },
        captureOpts,
      );
      opts.onCapture?.(result);
      return result;
    },

    toJSON(): SerializedMarkStore {
      const out: Record<string, unknown> = {};
      for (const [target, scene] of scenes) setOwn(out, target, scene.toJSON());
      return { version: 1, scenes: out, history: markHistoryOf(history, scenes) };
    },
  };
}

/** Rebuild a store from what `toJSON` wrote. Unknown or future versions give
 *  an empty store rather than throwing: a lab that cannot read its marks
 *  should still open. */
export function annotationsFromJSON(
  raw: unknown,
  targets: () => readonly AnnotationTargetInfo[],
  rest: Omit<AnnotationStoreOptions, 'targets' | 'restore' | 'history'> = {},
): AnnotationsApi {
  const doc = raw as Partial<SerializedMarkStore> | null;
  if (doc?.version !== 1 || !doc.scenes) return createMarkStore({ targets, ...rest });
  return createMarkStore({ targets, restore: doc.scenes, history: doc.history, ...rest });
}
