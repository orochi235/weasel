import type { ReactElement } from 'react';
import type { GradStop } from '@weasel-js/core';
import { CloseButton } from '../CloseButton';
import { ColorField } from '../ColorField';
import { NumberField } from '../NumberField';
import s from './GradientStops.module.css';

/** How a stop's position is written: in the editor's field and as its handle's spoken value. */
export const POSITION_FORMAT: Intl.NumberFormatOptions = { style: 'percent', maximumFractionDigits: 1 };

/** A position as the field would write it back, so a blur that only re-rounds the text is not an edit. */
const shown = (offset: number): number => Math.round(offset * 1000);

/**
 * The editor for the one selected stop: its position, its color and opacity,
 * and its removal. `place` and `count` are where the stop sits along the
 * gradient, counted from 1, and how many there are.
 */
export function StopEditor(props: {
  stop: GradStop;
  place: number;
  count: number;
  removable: boolean;
  onColorInput: (color: string) => void;
  onColorChange: (color: string) => void;
  onOffsetChange: (offset: number) => void;
  onRemove: () => void;
}): ReactElement {
  const { stop, place, count, removable } = props;
  const name = `Stop ${place}`;
  return (
    <div className={s.editor} role="group" aria-label={`${name} of ${count}`}>
      <NumberField
        aria-label={`${name} position`}
        className={s.position}
        width="fit"
        hideSteppers
        value={stop.offset}
        minValue={0}
        maxValue={1}
        formatOptions={POSITION_FORMAT}
        onChange={(next) => {
          if (Number.isFinite(next) && shown(next) !== shown(stop.offset)) props.onOffsetChange(next);
        }}
      />
      <ColorField
        value={stop.color}
        alpha
        aria-label={name}
        className={s.color}
        onInput={props.onColorInput}
        onChange={props.onColorChange}
      />
      <CloseButton
        ariaLabel={`Remove stop ${place}`}
        tooltip="Remove stop"
        disabled={!removable}
        onClick={props.onRemove}
      />
    </div>
  );
}
