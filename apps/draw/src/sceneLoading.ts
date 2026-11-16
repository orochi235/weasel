import { solid, strokeOf } from '@weasel-js/paint';
import {
  type AddNodeSpec,
  asNodeId,
  createScene,
  decodeSnapshot,
  isSerializedScene,
  type PagesDoc,
  rectPath,
  type SavedScene,
  type SerializedDoc,
} from '@weasel-js/core';
import { docFromSnapshot, readStored } from '@weasel-js/editor';
import { BACKGROUND_KEY } from './docBackground';
import { DEFAULT_BG_COLOR, loadDoc, PAPER_PRESETS } from './docPersistence';
import { DRAW_LAYERS, DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { onePage } from './pages/drawPages';
import { nodeSpecsFromSnapshot } from './persistence';
import { sessionRecords } from './sessionRecords';

export const LS_KEY = 'weaseldraw:scene-v1';

/** Where a second undo stack, the mode machine's, was saved before it moved onto the scene's. */
export const LEGACY_HISTORY_KEY = 'weaseldraw:history-v1';

type DrawSnapshot = SavedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
type DrawSpec = AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Restore the persisted scene (if any) from the session's records, shaped for
 *  `useScene`'s full-form call signature: the full tree, page run and pages
 *  included, so groups, nesting and pages survive a reload. A drawing saved
 *  before its pages were nodes loads with them as nodes. Best-effort: any
 *  parse error, or a drawing draw's scene cannot hold, yields a fresh starter scene, one page with one example
 *  rectangle on it, so the canvas isn't empty on first run. */
export function loadInitial(): DrawSpec[] {
  return readStored(LS_KEY, (value) => specsOf(savedScene(value)), starterScene, sessionRecords());
}

/** The persisted scene's document values, or `undefined` for none. Its pages are nodes, not among them. A
 *  background saved beside the scene, as one was before it was the scene's, is taken in where the scene
 *  names none. */
export function loadInitialDoc(): SerializedDoc | undefined {
  const saved = readStored(LS_KEY, (value) => docFromSnapshot(savedScene(value)), () => undefined, sessionRecords());
  const legacy = loadDoc().backgroundColor;
  if (saved?.[BACKGROUND_KEY] !== undefined || legacy === DEFAULT_BG_COLOR) return saved;
  return { ...saved, [BACKGROUND_KEY]: legacy };
}

/** The pages a drawing saved before draw had pages gets: one of the paper size its document settings kept. */
export const fallbackPages = (): PagesDoc => onePage(PAPER_PRESETS[loadDoc().paperSize]);

/** The drawing a scene entry holds, decoded. */
function savedScene(value: unknown): DrawSnapshot {
  const json = decodeSnapshot(value);
  if (!isSerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>(json)) throw new Error('Not a saved drawing');
  return json;
}

/** `json`'s nodes, its pages among them as page nodes; a drawing saved before draw had pages gets
 *  {@link fallbackPages}. The pages are built in a scene of the drawing's layers, draw's own for one saved
 *  before its snapshots listed them. */
function specsOf(json: DrawSnapshot): DrawSpec[] {
  const systemLayers = (json.systemLayers as DrawSnapshot['systemLayers'] | undefined) ?? DRAW_LAYERS;
  return nodeSpecsFromSnapshot({ ...json, systemLayers }, DRAW_REGISTRY, fallbackPages(), DRAW_LAYERS);
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
