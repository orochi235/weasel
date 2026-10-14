import { MEASURE_ACTION_IDS, type MeasurementStore, useMeasurement } from '@weasel-js/core';
import { decimal, qty } from '@weasel-js/quantity';
import { ActionBar } from '@weasel-js/ui';
import type { ReactElement } from 'react';
import s from './MeasureHud.module.css';

const LABELS = {
  [MEASURE_ACTION_IDS.moveBy]: 'Move by',
  [MEASURE_ACTION_IDS.rotateBy]: 'Rotate by',
  [MEASURE_ACTION_IDS.clear]: 'Clear',
};

const AT = decimal({ places: 2, grouping: false });
const format = (n: number): string => qty(n, AT).text;

/**
 * The measure tool's readout, in the workspace while a measurement is held:
 * its distance, offset, and angle in world units, and the commands that move
 * or turn the selection by it. The angle reads in the canvas's own sense,
 * clockwise positive, so it is the angle "Rotate by" turns.
 */
export function MeasureHud({ store }: { store: MeasurementStore }): ReactElement | null {
  const m = useMeasurement(store);
  if (!m) return null;
  const cells: [string, string][] = [
    ['Distance', format(m.distance)],
    ['ΔX', format(m.dx)],
    ['ΔY', format(m.dy)],
    ['Angle', `${format((m.angle * 180) / Math.PI)}°`],
  ];
  return (
    <div className={s.hud} role="group" aria-label="Measurement">
      <ActionBar group="measure" labels={LABELS} className={s.actions} />
      {cells.map(([name, value]) => (
        <span key={name} className={s.cell}>
          <span className={s.name}>{name}</span>
          <output className={s.value}>{value}</output>
        </span>
      ))}
    </div>
  );
}
