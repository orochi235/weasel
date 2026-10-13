import {
  type AddNodeSpec,
  asNodeId,
  rectPath,
  SCENE_HISTORY_FORM,
  type SerializedScene,
  type SerializedSceneHistory,
  solid,
  strokeOf
} from '@weasel-js/core';
import type { SerializedHistory } from '@weasel-js/history';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { nodeSpecsFromSnapshot, reviveSnapshot } from './persistence';

export const LS_KEY = 'weaseldraw:scene-v1';

export const HISTORY_KEY = 'weaseldraw:history-v1';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from localStorage. Returns the
 *  initial node list shaped for `useScene`'s full-form call signature.
 *  Rebuilds the FULL tree (containers + parent links + layers) via
 *  `nodeSpecsFromSnapshot`, so Cmd+G groups and nesting survive a reload.
 *  Best-effort — any parse error yields a fresh starter scene with one
 *  example rectangle so the canvas isn't empty on first run. */
export function loadInitial(): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const json = JSON.parse(raw) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
      if (json && json.version === 1 && Array.isArray(json.nodes)) {
        return nodeSpecsFromSnapshot(json);
      }
    }
  } catch {
    // fall through to starter
  }
  return [{
    kind: 'leaf' as const,
    layer: 'default' as WeaselDrawLayer,
    pose: { x: 80, y: 80, width: 160, height: 100 },
    data: {
      path: rectPath(80, 80, 160, 100),
      fill: { paint: solid('#7ab8d4') },
      stroke: strokeOf('#0a3654', 2),
      label: 'Welcome',
    },
    id: asNodeId('starter-1'),
  }];
}

/** Read the persisted undo/redo history snapshot, reviving the typed arrays
 *  inside its serialized op payloads (poses/paths carry Float32Array coords).
 *  Best-effort — returns null on absent/corrupt data or a version mismatch,
 *  in which case the app starts with an empty undo stack. */
export function loadHistory(): SerializedHistory | null {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as SerializedHistory;
    if (snap && snap.version === 1) return reviveSnapshot(snap);
  } catch {
    // fall through to no-history
  }
  return null;
}

export const SCENE_HISTORY_KEY = 'weaseldraw:scene-history-v1';

/** Read the persisted SCENE undo/redo snapshot (the scene's own history
 *  engine, distinct from the modality history above). Best-effort; on
 *  absent/corrupt/mismatched data, or a snapshot in an older recorded form,
 *  returns null AND removes the key so a broken snapshot can't wedge every
 *  boot. */
export function loadSceneHistory(): SerializedSceneHistory | null {
  try {
    const raw = localStorage.getItem(SCENE_HISTORY_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as SerializedSceneHistory;
      if (snap && snap.version === 1 && snap.form === SCENE_HISTORY_FORM) return reviveSnapshot(snap);
    }
  } catch {
    // fall through to wipe
  }
  try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
  return null;
}
