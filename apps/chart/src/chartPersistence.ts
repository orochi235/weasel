import type { AddNodeSpec, SerializedScene } from '@weasel-js/core';
import { nodeSpecsFromSnapshot, serializeReplacer } from '@editor/index';
import { CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose, type ChartScene } from './chartDocument';

export const CHART_SCENE_KEY = 'weaselchart:scene-v1';
export const CHART_HISTORY_KEY = 'weaselchart:history-v1';
export const CHART_FILE_EXTENSION = '.weaselchart.json';

type ChartSpec = AddNodeSpec<ChartData, ChartLayer, ChartPose>;

/** The chart as the text a `.weaselchart.json` file and the session store hold. */
export function chartToJson(scene: ChartScene): string {
  return JSON.stringify(scene.toJSON(), serializeReplacer);
}

/** The node specs a saved chart holds. Throws on text that is not one. */
export function chartFromJson(text: string): ChartSpec[] {
  const json = JSON.parse(text) as SerializedScene<ChartData, ChartLayer, ChartPose>;
  if (json?.version !== 1 || !Array.isArray(json.nodes)) throw new Error('Not a saved chart');
  return nodeSpecsFromSnapshot(json, CHART_REGISTRY);
}

/** The chart the last session left, or an empty one. */
export function loadChartSession(): ChartSpec[] {
  try {
    const raw = localStorage.getItem(CHART_SCENE_KEY);
    return raw ? chartFromJson(raw) : [];
  } catch {
    return [];
  }
}

/** Replaces everything in the chart with `specs`, as one undo entry. */
export function replaceChart(scene: ChartScene, specs: readonly ChartSpec[], label: string): void {
  scene.batch(label, () => {
    scene.removeMany([...scene.renderOrder()]);
    for (const spec of specs) scene.add(spec);
  });
}
