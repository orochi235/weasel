import { createScene, type Scene, sceneFromJSON } from '@weasel-js/core';
import { ownAt } from '../config/path';
import type { WorldRect } from './frac';
import { type MarkHistory, restoreSceneHistory } from './history';
import { migrateLegacyPoints, type SerializedMarks } from './markShape';
import type { AnnotationData } from './types';

/** A mark's box in its target's world. Matches weasel's default `RectPose`. */
export type MarkPose = WorldRect;

/** The scene one target's marks live in. */
export type MarkScene = Scene<AnnotationData, 'marks', MarkPose>;

/** A mark scene: one layer, because marks do not stack in tiers. */
export function createMarkScene(): MarkScene {
  return createScene<AnnotationData, 'marks', MarkPose>({ systemLayers: [{ id: 'marks' }] });
}

/** What `createMarkScenes` reads. Fixed for the store's life. */
export interface MarkScenesOptions {
  /** Serialized scenes from a previous `toJSON`, keyed by target. */
  restore?: Readonly<Record<string, unknown>>;
  /** The undo history the same `toJSON` wrote beside them. */
  historyJSON?: unknown;
  /** The ordering every scene opened here joins. */
  history: MarkHistory;
  /** A target's content box, to migrate a legacy save into world units. */
  contentOf: (target: string) => { width: number; height: number };
  /** Whether selecting in one target clears the others. Read at each change. */
  exclusive: () => boolean;
  /** Tells subscribers something changed. */
  notify: () => void;
}

/** One scene per target, opened on first ask, with their change notices merged. */
export interface MarkScenes {
  readonly scenes: ReadonlyMap<string, MarkScene>;
  openScene(target: string): MarkScene;
  /** Runs `fn`, telling subscribers about the scene changes it made as one
   *  notice once the outermost hold ends. */
  hold(fn: () => void): void;
}

/**
 * The store's scenes and the one channel their changes reach subscribers on.
 * A click that selects in one target and so clears another, or a selection
 * spanning several, is one notice with the final answer.
 */
export function createMarkScenes(opts: MarkScenesOptions): MarkScenes {
  const { restore, history, contentOf, exclusive, notify } = opts;
  const scenes = new Map<string, MarkScene>();

  let holding = 0;
  let heldDirty = false;
  const hold = (fn: () => void): void => {
    holding += 1;
    try {
      fn();
    } finally {
      holding -= 1;
    }
    if (holding === 0 && heldDirty) {
      heldDirty = false;
      notify();
    }
  };

  /** Each scene's selection as last seen, to tell a selection change from any
   *  other change arriving on the same channel. */
  const lastSelection = new Map<string, string>();
  const selectionKey = (scene: MarkScene): string => scene.getSelection().map(String).join(' ');

  const clearOthers = (keep: string): void => {
    for (const [target, scene] of scenes) {
      if (target !== keep && scene.getSelection().length > 0) scene.setSelection([]);
    }
  };

  const onChange = (target: string, scene: MarkScene): void => {
    history.observe(target, scene);
    const selected = selectionKey(scene);
    const newlySelected = selected !== '' && selected !== lastSelection.get(target);
    lastSelection.set(target, selected);
    if (holding > 0) {
      heldDirty = true;
      return;
    }
    if (newlySelected && exclusive()) {
      hold(() => {
        heldDirty = true;
        clearOthers(target);
      });
    } else {
      notify();
    }
  };

  const openScene = (target: string): MarkScene => {
    const known = scenes.get(target);
    if (known) return known;
    const raw = restore ? ownAt(restore, target) : undefined;
    const scene = raw
      ? sceneFromJSON<AnnotationData, 'marks', MarkPose>(
          migrateLegacyPoints(raw as SerializedMarks, contentOf(target)),
          {},
        )
      : createMarkScene();
    if (raw) restoreSceneHistory(scene, target, opts.historyJSON);
    scenes.set(target, scene);
    history.track(target, scene);
    lastSelection.set(target, selectionKey(scene));
    scene.subscribe(() => onChange(target, scene));
    return scene;
  };

  // Restored scenes are materialized up front: the store reads `scenes`, and a
  // mark that only appears once its pane asks for its scene is a mark a sidebar
  // cannot list.
  for (const target of Object.keys(restore ?? {})) openScene(target);

  return { scenes, openScene, hold };
}
