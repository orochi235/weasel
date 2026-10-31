/** Dragging a quadrant chart's points, and editing its text in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { compileQuadrant, quadrantValueAt } from './compile';
import { setQuadrantAxisLabel, setQuadrantLabel, setQuadrantPoint, setQuadrantPointName } from './edit';
import type { QuadrantData } from './types';

const pointOf = (data: QuadrantData, datum: unknown): number | null => {
  const p = (datum as { point?: unknown } | undefined)?.point;
  return typeof p === 'number' && data.points[p] !== undefined ? p : null;
};

/** A point takes a press and moves with the pointer; the title, axis labels, quadrant labels and point names take a text edit. */
export const quadrantEditor: PlotEditor<QuadrantData> = {
  handle(data, { trait, pose }) {
    if (trait.kind !== 'point' || pointOf(data, trait.datum) === null) return null;
    return { at: { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 }, cursor: 'move' };
  },
  drag(data, trait, size, theme, measure) {
    const point = pointOf(data, trait.datum);
    if (point === null) return null;
    const { layout } = compileQuadrant(data, size, theme, measure);
    return (at) => setQuadrantPoint(data, point, quadrantValueAt(layout, at));
  },
  text(data, datum, text) {
    const t = text.trim();
    switch (datum.edit) {
      case 'title': return withTitle(data, text);
      case 'axis':
        return (datum.axis === 'x' || datum.axis === 'y') && (datum.end === 'low' || datum.end === 'high')
          ? setQuadrantAxisLabel(data, datum.axis, datum.end, t) : data;
      case 'quadrant':
        return typeof datum.quadrant === 'number' && [1, 2, 3, 4].includes(datum.quadrant) ? setQuadrantLabel(data, datum.quadrant, t) : data;
      case 'point': {
        const point = pointOf(data, datum);
        return point === null || t === '' ? data : setQuadrantPointName(data, point, t);
      }
      default: return data;
    }
  },
};
