import {
  AUTO_POSE_DESCRIPTOR, PAGES_DOC_KEY, isSerializedScene, type AddNodeSpec, type SavedScene, type SerializedDoc,
} from '@weasel-js/core';
import { DIAGRAM_TYPE_DOC_KEY, FLOWCHART_TYPE, diagramTypeDocValue } from '@weasel-js/diagram';
import { addDocumentScene, type DocumentScene } from '@weasel-js/diagram-formats';
import { docFromSnapshot, nodeSpecsFromSnapshot, readStored, reviveTypedArrays, serializeReplacer } from '@weasel-js/editor';
import {
  CHART_LAYERS, CHART_PAGES, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose, type ChartScene,
} from './chartDocument';

export const CHART_SCENE_KEY = 'weaselchart:scene-v1';
export const CHART_HISTORY_KEY = 'weaselchart:history-v1';
export const CHART_FILE_EXTENSION = '.weaselchart.json';

type ChartSpec = AddNodeSpec<ChartData, ChartLayer, ChartPose>;
type ChartSnapshot = SavedScene<ChartData, ChartLayer, ChartPose>;

/** What a saved chart holds: its nodes, its page run and pages among them, and its document values. */
export interface ChartFile {
  specs: ChartSpec[];
  doc: SerializedDoc;
}

const hasPageNodes = (json: ChartSnapshot): boolean => json.nodes.some((n) => n.pageRun !== undefined);

/**
 * The chart `json` holds, its pages as page nodes. One that kept its pages as the `core:pages` value is converted
 * (`nodeSpecsFromSnapshot` adopts them), and one saved before charts had pages is given {@link CHART_PAGES} first, so
 * both go through the same conversion.
 */
function chartOf(json: ChartSnapshot): ChartFile {
  const paged = json.doc?.[PAGES_DOC_KEY] !== undefined || hasPageNodes(json);
  const doc = paged ? json.doc : { ...json.doc, [PAGES_DOC_KEY]: CHART_PAGES };
  const systemLayers = (json.systemLayers as ChartSnapshot['systemLayers'] | undefined) ?? CHART_LAYERS;
  const specs = nodeSpecsFromSnapshot(
    { ...json, systemLayers, doc } as ChartSnapshot, CHART_REGISTRY, reviveTypedArrays, { descriptor: AUTO_POSE_DESCRIPTOR },
  );
  return { specs, doc: docFromSnapshot(json) ?? {} };
}

/** A chart of diagram type `type` with nothing on its one page. */
export const emptyChart = (type: string = FLOWCHART_TYPE.id): ChartFile =>
  chartOf({ version: 3, systemLayers: CHART_LAYERS, nodes: [], doc: { [DIAGRAM_TYPE_DOC_KEY]: diagramTypeDocValue(type) } });

/** The chart as the text a `.weaselchart.json` file and the session store hold. */
export function chartToJson(scene: ChartScene): string {
  return JSON.stringify(scene.toJSON(), serializeReplacer);
}

/** The chart a saved file holds. Throws on text that is not one. */
export function chartFromJson(text: string): ChartFile {
  const json: unknown = JSON.parse(text);
  if (!isSerializedScene<ChartData, ChartLayer, ChartPose>(json)) throw new Error('Not a saved chart');
  return chartOf(json);
}

/** The chart the last session left, or an empty one. */
export function loadChartSession(): ChartFile {
  return readStored(CHART_SCENE_KEY, chartFromJson, () => emptyChart());
}

/** The undo stack the last session left, or `null` where that session's chart had no page nodes: its stack was
 *  recorded against a tree the load has since rebuilt, so it would replay wrongly. */
export function loadChartHistory(): unknown {
  const paged = readStored(CHART_SCENE_KEY, (raw) => {
    const json: unknown = JSON.parse(raw);
    return isSerializedScene<ChartData, ChartLayer, ChartPose>(json) && hasPageNodes(json);
  }, () => false);
  if (!paged) {
    try { localStorage.removeItem(CHART_HISTORY_KEY); } catch { /* best-effort */ }
    return null;
  }
  return readStored(CHART_HISTORY_KEY, (raw) => reviveTypedArrays(JSON.parse(raw) as unknown), () => null);
}

/** Replaces everything in the chart, nodes, pages and document values, with `file`, as one undo entry. */
export function replaceChart(scene: ChartScene, file: ChartFile, label: string): void {
  scene.batch(label, () => {
    scene.removeMany([...scene.roots]);
    for (const spec of file.specs) scene.add(spec);
    for (const key of scene.doc.keys()) if (!(key in file.doc)) scene.doc.set(key, undefined);
    for (const [key, value] of Object.entries(file.doc)) scene.doc.set(key, value);
  });
}

/** Replaces everything in the chart, nodes, pages and document values, with the diagram document `drawn`, placed on
 *  its pages, or on one page of the chart page size where it has none. One undo entry. */
export function replaceChartWithDocument(scene: ChartScene, drawn: DocumentScene<ChartLayer>, label: string): void {
  addDocumentScene(scene, drawn.pages.length > 0 ? drawn : { ...drawn, pages: [...CHART_PAGES.pages] }, label);
}
