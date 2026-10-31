/** A sankey compiled to its scales and marks. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { barMark } from '../marks/boxes';
import { ribbonMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { seriesColor, type PlotTheme } from '../theme';
import { sankeyLayout, type SankeyLayout, type SankeyNodeBox } from './layout';
import type { SankeyData } from './types';

const LABEL_GAP = 6;

/** A flow as a label reads it, free of float noise. */
export const formatFlow = (v: number): string => String(Number(v.toPrecision(12)));

/** A node's label and its value beside it: right of a node in the left half, left of one in the right. */
function nodeLabels(node: SankeyNodeBox, k: number, columns: number, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const right = node.column * 2 < columns - 1 || columns === 1;
  const x = right ? node.x + node.width + LABEL_GAP : node.x - LABEL_GAP;
  const y = node.y + node.height / 2;
  const anchor = right ? 'start' : 'end';
  const base = { x, anchor, font: theme.font, color: theme.text, measure } as const;
  return [
    textMark({ ...base, key: `node:${k}:label`, text: node.label, y, baseline: 'bottom', datum: { edit: 'node', node: node.label } }),
    textMark({ ...base, key: `node:${k}:value`, text: formatFlow(node.value), y, baseline: 'top' }),
  ];
}

/** Lays out a sankey in a box of `size`: its title, a bar per node with its label and value, a ribbon per link with its value. */
export function compileSankey(
  data: SankeyData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: SankeyLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const box = { x: PAD, y: top, width: Math.max(1, size.width - 2 * PAD), height: Math.max(1, size.height - PAD - top) };
  const layout = sankeyLayout(data, box);
  layout.links.forEach((r, i) => {
    marks.push(ribbonMark({ key: `link:${i}`, from: r.from, to: r.to, color: seriesColor(theme, r.source), datum: { link: i } }));
  });
  layout.nodes.forEach((node, k) => {
    marks.push(barMark({ key: `node:${k}`, x: node.x, width: node.width, from: node.y, to: node.y + node.height, color: seriesColor(theme, k), datum: { node: node.label } }));
  });
  layout.links.forEach((r, i) => {
    marks.push(textMark({
      key: `link:${i}:value`, text: formatFlow(data.links[i]!.value), x: (r.from.x + r.to.x) / 2,
      y: (r.from.y0 + r.from.y1 + r.to.y0 + r.to.y1) / 4, font: theme.font, color: theme.text, measure, datum: { edit: 'value', link: i },
    }));
  });
  layout.nodes.forEach((node, k) => marks.push(...nodeLabels(node, k, layout.columns, theme, measure)));
  return { marks, layout };
}
