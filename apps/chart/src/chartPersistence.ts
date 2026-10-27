import { isSerializedScene, type AddNodeSpec, type SerializedDoc } from '@weasel-js/core';
import { DIAGRAM_TYPE_DOC_KEY, FLOWCHART_TYPE, diagramTypeDocValue } from '@weasel-js/diagram';
import { docFromSnapshot, nodeSpecsFromSnapshot, readStored, serializeReplacer } from '@editor/index';
import { CHART_REGISTRY, chartDoc, type ChartData, type ChartLayer, type ChartPose, type ChartScene } from './chartDocument';

export const CHART_SCENE_KEY = 'weaselchart:scene-v1';
export const CHART_HISTORY_KEY = 'weaselchart:history-v1';
export const CHART_FILE_EXTENSION = '.weaselchart.json';

type ChartSpec = AddNodeSpec<ChartData, ChartLayer, ChartPose>;

/** What a saved chart holds: its nodes, and its document values, the page list always among them. */
export interface ChartFile {
  specs: ChartSpec[];
  doc: SerializedDoc;
}

/** A chart of diagram type `type` with nothing on its one page. */
export const emptyChart = (type: string = FLOWCHART_TYPE.id): ChartFile =>
  ({ specs: [], doc: chartDoc({ [DIAGRAM_TYPE_DOC_KEY]: diagramTypeDocValue(type) }) });

/** The chart as the text a `.weaselchart.json` file and the session store hold. */
export function chartToJson(scene: ChartScene): string {
  return JSON.stringify(scene.toJSON(), serializeReplacer);
}

/** The chart a saved file holds. Throws on text that is not one. */
export function chartFromJson(text: string): ChartFile {
  const json: unknown = JSON.parse(text);
  if (!isSerializedScene<ChartData, ChartLayer, ChartPose>(json)) throw new Error('Not a saved chart');
  return { specs: nodeSpecsFromSnapshot(json, CHART_REGISTRY), doc: chartDoc(docFromSnapshot(json)) };
}

/** The chart the last session left, or an empty one. */
export function loadChartSession(): ChartFile {
  return readStored(CHART_SCENE_KEY, chartFromJson, () => emptyChart());
}

/** Replaces everything in the chart, nodes and document values, with `file`, as one undo entry. */
export function replaceChart(scene: ChartScene, file: ChartFile, label: string): void {
  scene.batch(label, () => {
    scene.removeMany([...scene.renderOrder()]);
    for (const spec of file.specs) scene.add(spec);
    for (const key of scene.doc.keys()) if (!(key in file.doc)) scene.doc.set(key, undefined);
    for (const [key, value] of Object.entries(file.doc)) scene.doc.set(key, value);
  });
}
