import { createContext, useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import { Label, RadioGroup as RACRadioGroup } from 'react-aria-components';
import { runStationAt, type RunAlign, type TrackRun, type TrackShape } from '@weasel-js/geom';
import { useRowRun } from '../Along/useRowRun';
import { AlongContext } from '../Along/alongContext';
import { placeStyle } from '../Along/placeOnRun';
import { bendAt } from '../Along/runBend';
import { createRunSlots, RUN_HOST, slotClass, slotOf, useRunSlotHost, type RunSlots } from '../Along/runSlots';
import { useRunGap } from '../Along/useItemLengths';
import { RunBand, RunEnds } from '../Along/useRunRow';
import { FieldFoot } from '../Field/fieldSlots';
import type { RadioGroupProps } from './RadioGroup';
import s from './RadioGroup.module.css';

/** The channel a radio group laid along a run hands its radios their places on. */
export const RadioSlotsContext = createContext<RunSlots | null>(null);

/** The group label's key on the run: one no radio's value can be. */
const LEAD = '\u0000lead';

/** Props for {@link RadioGroupAlong}: a radio group's, with the shape it lies along settled. */
export type RadioGroupAlongProps = RadioGroupProps & { shape: TrackShape; align: RunAlign };

/**
 * A radio group whose label and radios lie along a curved track shape from its own start, the label first and not
 * pressable, as a curved bar's lead. Its description and error sit at the middle of the run one row further in, toward
 * the inside of the bend. A row too long for the run scrolls along it.
 */
export function RadioGroupAlong({ label, description, errorMessage, children, className, shape, align, ...rest }: RadioGroupAlongProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const run = useRowRun(root, shape);
  const slots = useMemo(() => createRunSlots(), []);
  const gap = useRunGap(root);
  const host = useRunSlotHost({ slots, root, run, gap, align });
  const lead = slotOf(slots.current(), LEAD);
  const { className: _, ...leadAt } = lead ?? {};
  return (
    <div ref={root} {...{ [RUN_HOST]: '' }} {...host.rootProps} className={s.along} data-shape={shape.kind}>
      <RunBand row={host} shape={shape} />
      <RACRadioGroup {...rest} className={[s.group, s.alongGroup, className].filter(Boolean).join(' ')}>
        <RadioSlotsContext.Provider value={slots}>
          <AlongContext.Provider value={null}>
            {label !== undefined && <Label {...leadAt} className={slotClass(lead, `${s.legend} ${s.lead}`)}>{label}</Label>}
            {children}
          </AlongContext.Provider>
        </RadioSlotsContext.Provider>
        <span className={s.hint} style={hintStyle(run, host.thickness / 2 + gap)} data-radio-hint="">
          <FieldFoot description={description} errorMessage={errorMessage} />
        </span>
      </RACRadioGroup>
      <RunEnds row={host} run={run} />
    </div>
  );
}

/**
 * Where the description and error hang from: the run's middle moved `inward` px toward the inside of its bend, the
 * block hanging further in from there. A run that does not bend has its inside below.
 */
function hintStyle(run: TrackRun, inward: number): CSSProperties {
  const side = bendAt(run, 0.5) === 1 ? 1 : -1;
  return { ...placeStyle(runStationAt(run, run.length / 2, side * inward)), '--hang': -side } as CSSProperties;
}
