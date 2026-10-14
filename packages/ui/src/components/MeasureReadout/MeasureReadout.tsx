import { MEASURE_ACTION_IDS, type MeasurementStore, useMeasurement } from '@weasel-js/core';
import { decimal, qty } from '@weasel-js/quantity';
import type { ReactElement } from 'react';
import { ActionBar } from '../ActionBar';
import s from './MeasureReadout.module.css';

const LABELS = {
  [MEASURE_ACTION_IDS.moveBy]: 'Move by',
  [MEASURE_ACTION_IDS.rotateBy]: 'Rotate by',
  [MEASURE_ACTION_IDS.clear]: 'Clear',
};

const AT = decimal({ places: 2, grouping: false });
const format = (n: number): string => qty(n, AT).text;

/** Props for {@link MeasureReadout}. */
export interface MeasureReadoutProps {
  /** The measure tool's store — the one passed as `useMeasureTool({ store })`. */
  store: MeasurementStore;
  /** Additional class for the root, to place it. */
  className?: string;
}

/**
 * The measure tool's readout: a chip pinned to the bottom of the nearest
 * positioned ancestor while a measurement is held, with its distance, offset,
 * and angle in world units, and the `measure` group's commands — Move by,
 * Rotate by, Clear — drawn from the actions registry. The angle reads in the
 * canvas's own sense, clockwise positive, so it is the angle "Rotate by" turns.
 */
export function MeasureReadout({ store, className }: MeasureReadoutProps): ReactElement | null {
  const m = useMeasurement(store);
  if (!m) return null;
  const cells: [string, string][] = [
    ['Distance', format(m.distance)],
    ['ΔX', format(m.dx)],
    ['ΔY', format(m.dy)],
    ['Angle', `${format((m.angle * 180) / Math.PI)}°`],
  ];
  return (
    <div className={[s.readout, className].filter(Boolean).join(' ')} role="group" aria-label="Measurement">
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
