/** Dragging an xychart's bar ends and line points to change their values. */
import type { PlotEditor } from '../editing/editors';
import { compileXyChart } from './compile';
import { setXyValue, xyValueAt } from './edit';
import type { XyChartData } from './types';

const seriesIndex = (datum: unknown): { series: number; index: number } | null => {
  const d = datum as { series?: unknown; index?: unknown } | undefined;
  return typeof d?.series === 'number' && typeof d.index === 'number' ? { series: d.series, index: d.index } : null;
};

/** A bar's value end and a line's points take a press; a drag moves the value along the value axis. */
export const xyEditor: PlotEditor<XyChartData> = {
  handle(data, { trait, pose }) {
    if ((trait.kind !== 'bar' && trait.kind !== 'point') || seriesIndex(trait.datum) === null) return null;
    const vertical = data.orientation !== 'horizontal';
    const cursor = vertical ? 'ns-resize' : 'ew-resize';
    const cx = pose.x + pose.width / 2;
    const cy = pose.y + pose.height / 2;
    if (trait.kind === 'point') return { at: { x: cx, y: cy }, cursor };
    const up = Number(trait.datum?.value ?? 0) >= 0;
    return vertical
      ? { at: { x: cx, y: up ? pose.y : pose.y + pose.height }, cursor }
      : { at: { x: up ? pose.x + pose.width : pose.x, y: cy }, cursor };
  },
  drag(data, trait, size, theme, measure) {
    const which = seriesIndex(trait.datum);
    if (which === null) return null;
    const { layout } = compileXyChart(data, size, theme, measure);
    return (at) => setXyValue(data, which.series, which.index, xyValueAt(layout, at));
  },
};
