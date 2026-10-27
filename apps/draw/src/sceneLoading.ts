import {
  type AddNodeSpec,
  asNodeId,
  isSerializedScene,
  rectPath,
  SCENE_HISTORY_FORM,
  type SerializedDoc,
  type SerializedSceneHistory,
  solid,
  strokeOf
} from '@weasel-js/core';
import { docFromSnapshot, readStored } from '@editor/index';
import { loadDoc, PAPER_PRESETS } from './docPersistence';
import { DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { drawDoc } from './pages/drawPages';
import { nodeSpecsFromSnapshot, reviveSnapshot } from './persistence';

export const LS_KEY = 'weaseldraw:scene-v1';

/** Where a second undo stack, the mode machine's, was saved before it moved onto the scene's. */
export const LEGACY_HISTORY_KEY = 'weaseldraw:history-v1';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from localStorage. Returns the
 *  initial node list shaped for `useScene`'s full-form call signature.
 *  Rebuilds the FULL tree (containers + parent links + layers) via
 *  `nodeSpecsFromSnapshot`, so Cmd+G groups and nesting survive a reload.
 *  Best-effort — any parse error yields a fresh starter scene with one
 *  example rectangle so the canvas isn't empty on first run. */
export function loadInitial(): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>[] {
  return readStored(LS_KEY, parseScene, starterScene);
}

/** The persisted scene's document values, its page list always among them: a drawing saved
 *  before draw had pages gets one page of the paper size its document settings kept. */
export function loadInitialDoc(): SerializedDoc {
  const saved = readStored(LS_KEY, (raw) => docFromSnapshot(savedScene(raw)), () => undefined);
  return drawDoc(saved, PAPER_PRESETS[loadDoc().paperSize]);
}

function savedScene(raw: string) {
  const json: unknown = JSON.parse(raw);
  if (!isSerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>(json)) throw new Error('Not a saved drawing');
  return json;
}

function parseScene(raw: string): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>[] {
  return nodeSpecsFromSnapshot(savedScene(raw), DRAW_REGISTRY);
}

function starterScene(): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>[] {
  return [{
    kind: 'mark' as const,
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

export const SCENE_HISTORY_KEY = 'weaseldraw:scene-history-v1';

/** Read the persisted undo/redo snapshot. Best-effort; on
 *  absent/corrupt/mismatched data, or a snapshot in an older recorded form,
 *  returns null AND removes the key so a broken snapshot can't wedge every
 *  boot. */
export function loadSceneHistory(): SerializedSceneHistory | null {
  const snap = readStored(SCENE_HISTORY_KEY, parseSceneHistory, () => null);
  if (snap === null) {
    try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
  }
  return snap;
}

function parseSceneHistory(raw: string): SerializedSceneHistory | null {
  const snap = JSON.parse(raw) as SerializedSceneHistory;
  return snap?.version === 1 && snap.form === SCENE_HISTORY_FORM ? reviveSnapshot(snap) : null;
}
