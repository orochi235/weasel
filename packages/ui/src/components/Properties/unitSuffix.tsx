import type { ReactNode } from 'react';
import { unitSymbol } from '@weasel-js/quantity';
import { QuantityText } from '../QuantityText';
import s from './Properties.module.css';

/** Whether `unit` is text the unit catalog writes as a glyph that attaches to the number: `°`, `″`, `%`. */
export function attachesUnit(unit: ReactNode): unit is string {
  return typeof unit === 'string' && unitSymbol(unit).attaches;
}

/**
 * A field's or a readout's unit. One that attaches sits on the value's line, out of flow, against the nearest
 * `.unitHost`, whatever the layout does with other units; any other is drawn in `className`, in flow.
 */
export function UnitSuffix({ unit, className }: { unit: ReactNode; className?: string }) {
  if (unit == null) return null;
  if (attachesUnit(unit)) {
    return (
      <span className={s.unitAttached} data-wzl-subordinate="">
        <QuantityText unit={unit} />
      </span>
    );
  }
  return (
    <span className={s.unitMark} data-wzl-subordinate="">
      {typeof unit === 'string' ? <QuantityText unit={unit} className={className} /> : unit}
    </span>
  );
}
