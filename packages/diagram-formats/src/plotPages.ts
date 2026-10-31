/** Plot pages to and from a scene: one plot root per page, which the plot package compiles and keeps. */
import type { PlacedPage } from '@weasel-js/core';
import type { DiagramTheme, MeasureRowText } from '@weasel-js/diagram';
import { plotRootOf, plotSpecs, type PlotMeasure, type PlotSpec, type PlotTheme } from '@weasel-js/plot';
import type { PlotPage } from './document';

/** A diagram theme's colors by the roles a chart draws in: text in the label color, axes in the connector stroke,
 *  grid lines in the container stroke, series in its series, in its face. */
export function plotThemeOf(theme: DiagramTheme): PlotTheme {
  return {
    text: theme.label.fill,
    axis: theme.edge.stroke,
    grid: theme.container.stroke,
    series: theme.series.length > 0 ? theme.series : [theme.edge.stroke],
    font: { fontFamily: theme.font.family, fontSize: theme.font.size },
  };
}

/** A row measurer as a plot measures a line. */
export const plotMeasureOf = (measure: MeasureRowText): PlotMeasure =>
  (text, font) => measure(text, { fontFamily: font.fontFamily, fontSize: font.fontSize });

/** The id of the plot root drawing the page `pageId`. */
export const plotRootIdOf = (pageId: string): string => `${pageId}/plot`;

/** The nodes plot page `page` draws as, filling it where it is placed. */
export function plotPageSpecs<TLayer extends string>(
  page: PlotPage, at: { x: number; y: number }, opts: { layer: TLayer; theme: DiagramTheme; measure?: MeasureRowText },
): PlotSpec<TLayer>[] {
  return plotSpecs(page.data, {
    id: plotRootIdOf(page.id), layer: opts.layer, box: { x: at.x, y: at.y, width: page.width, height: page.height },
    theme: plotThemeOf(opts.theme), ...(opts.measure ? { measure: plotMeasureOf(opts.measure) } : {}),
  });
}

/** The plot page `page` holds when the outermost node `root` placed on it is a plot root; `null` when it is not one. */
export function plotPageOf(page: PlacedPage, root: { data: unknown }): PlotPage | null {
  const trait = plotRootOf(root);
  if (trait === null) return null;
  return { kind: 'plot', id: page.id, ...(page.name !== undefined ? { name: page.name } : {}), width: page.width, height: page.height, data: trait.data };
}
