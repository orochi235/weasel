import { applyDiagramTheme, type ApplyDiagramThemeOptions, type DiagramTheme } from '@weasel-js/diagram';
import { plotMeasureOf, plotThemeOf } from '@weasel-js/diagram-formats';
import { plotRootOf, plotRootsIn, replacePlotData } from '@weasel-js/plot';
import type { ChartScene } from '../chartDocument';

/** Recolors the chart in `theme`, its shapes and its charts alike, as one undo entry. */
export function applyChartTheme(
  scene: ChartScene, theme: DiagramTheme, label = `Theme: ${theme.name}`, opts: ApplyDiagramThemeOptions = {},
): void {
  scene.batch(label, () => {
    applyDiagramTheme(scene, theme, label, opts);
    const plotTheme = plotThemeOf(theme);
    const measure = opts.measure === undefined ? {} : { measure: plotMeasureOf(opts.measure) };
    for (const id of plotRootsIn(scene as never)) {
      replacePlotData(scene, id, plotRootOf(scene.get(id))!.data, { label, theme: plotTheme, ...measure });
    }
  }, opts.coalesceKey !== undefined ? { coalesceKey: opts.coalesceKey } : {});
}
