/** Dragging a radar's points along their axes, and its title and labels edited in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { compileRadar } from './compile';
import { radarValueAt, setRadarAxisLabel, setRadarCurveLabel, setRadarValue } from './edit';
import type { RadarData } from './types';

const curveAxis = (datum: unknown): { curve: number; axis: number } | null => {
  const d = datum as { curve?: unknown; axis?: unknown } | undefined;
  return typeof d?.curve === 'number' && typeof d.axis === 'number' ? { curve: d.curve, axis: d.axis } : null;
};

/** Each curve's points take a press; a drag moves the value along its axis. */
export const radarEditor: PlotEditor<RadarData> = {
  handle(_data, { trait, pose }) {
    if (trait.kind !== 'point' || curveAxis(trait.datum) === null) return null;
    return { at: { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 }, cursor: 'move' };
  },
  drag(data, trait, size, theme, measure) {
    const which = curveAxis(trait.datum);
    if (which === null) return null;
    const { layout } = compileRadar(data, size, theme, measure);
    return (at) => setRadarValue(data, which.curve, which.axis, radarValueAt(layout, which.axis, at));
  },
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    if (datum.edit === 'axis' && typeof datum.axis === 'number') return setRadarAxisLabel(data, datum.axis, text);
    if (datum.edit === 'curve' && typeof datum.curve === 'number') return setRadarCurveLabel(data, datum.curve, text);
    return data;
  },
};
