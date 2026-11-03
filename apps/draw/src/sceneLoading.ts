import {
  type AddNodeSpec,
  asNodeId,
  createScene,
  isSerializedScene,
  PAGES_DOC_KEY,
  rectPath,
  type SavedScene,
  SCENE_HISTORY_FORM,
  type SerializedDoc,
  type SerializedSceneHistory,
  solid,
  strokeOf
} from '@weasel-js/core';
import { docFromSnapshot, readStored } from '@weasel-js/editor';
import { loadDoc, PAPER_PRESETS } from './docPersistence';
import { DRAW_LAYERS, DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { onePage } from './pages/drawPages';
import { nodeSpecsFromSnapshot, reviveSnapshot } from './persistence';

export const LS_KEY = 'weaseldraw:scene-v1';

/** Where a second undo stack, the mode machine's, was saved before it moved onto the scene's. */
export const LEGACY_HISTORY_KEY = 'weaseldraw:history-v1';

type DrawSnapshot = SavedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
type DrawSpec = AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from localStorage, shaped for
 *  `useScene`'s full-form call signature: the full tree, page run and pages
 *  included, so groups, nesting and pages survive a reload. A drawing saved
 *  before its pages were nodes loads with them as nodes. Best-effort: any
 *  parse error yields a fresh starter scene, one page with one example
 *  rectangle on it, so the canvas isn't empty on first run. */
export function loadInitial(): DrawSpec[] {
  return readStored(LS_KEY, (raw) => {
    const json = savedScene(raw);
    rebuilt = !hasPageNodes(json);
    return specsOf(json);
  }, () => {
    rebuilt = false;
    return starterScene();
  });
}

/** The persisted scene's document values, or `undefined` for none. Its pages are nodes, not among them. */
export function loadInitialDoc(): SerializedDoc | undefined {
  return readStored(LS_KEY, (raw) => docFromSnapshot(savedScene(raw)), () => undefined);
}

/** Whether the last {@link loadInitial} rebuilt a drawing saved without its pages as nodes, so an undo stack
 *  saved beside it would replay against a tree that is gone. `null` before one has run. */
let rebuilt: boolean | null = null;

const hasPageNodes = (json: DrawSnapshot) => json.nodes.some((n) => n.pageRun !== undefined);

function savedScene(raw: string): DrawSnapshot {
  const json: unknown = JSON.parse(raw);
  if (!isSerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>(json)) throw new Error('Not a saved drawing');
  return json;
}

/** `json`'s nodes, its pages among them as page nodes. A drawing saved before draw had pages gets one
 *  page of the paper size its document settings kept. The pages are built in a scene of the drawing's
 *  layers, draw's own for one saved before its snapshots listed them. */
function specsOf(json: DrawSnapshot): DrawSpec[] {
  const paged = json.doc?.[PAGES_DOC_KEY] !== undefined || hasPageNodes(json);
  const doc = paged ? json.doc : { ...json.doc, [PAGES_DOC_KEY]: onePage(PAPER_PRESETS[loadDoc().paperSize]) };
  const systemLayers = (json.systemLayers as DrawSnapshot['systemLayers'] | undefined) ?? DRAW_LAYERS;
  return nodeSpecsFromSnapshot({ ...json, systemLayers, doc }, DRAW_REGISTRY);
}

function starterScene(): DrawSpec[] {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: DRAW_LAYERS,
    initial: [{
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
    }],
  });
  return specsOf(scene.toJSON());
}

export const SCENE_HISTORY_KEY = 'weaseldraw:scene-history-v1';

/** Read the persisted undo/redo snapshot. Best-effort; on
 *  absent/corrupt/mismatched data, a snapshot in an older recorded form, or
 *  one saved beside a drawing whose pages were not yet nodes, returns null
 *  AND removes the key so a broken snapshot can't wedge every boot. */
export function loadSceneHistory(): SerializedSceneHistory | null {
  const stale = rebuilt ?? readStored(LS_KEY, (raw) => !hasPageNodes(savedScene(raw)), () => false);
  const snap = stale ? null : readStored(SCENE_HISTORY_KEY, parseSceneHistory, () => null);
  if (snap === null) {
    try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
  }
  return snap;
}

function parseSceneHistory(raw: string): SerializedSceneHistory | null {
  const snap = JSON.parse(raw) as SerializedSceneHistory;
  return snap?.version === 1 && snap.form === SCENE_HISTORY_FORM ? reviveSnapshot(snap) : null;
}
