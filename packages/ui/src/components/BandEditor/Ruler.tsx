import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, Ref } from 'react';
import { qty, type Display } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import { pct } from './track';

export interface RulerProps {
  trackRef: Ref<HTMLDivElement>;
  ticks?: { at: number; label?: ReactNode }[];
  /** Labels a tick that has no `label` of its own; without it such a tick is unlabeled. */
  display?: Display;
  toUnit: (value: number) => number;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/** `BandEditor`'s tick strip. Its box is the track every pointer position is measured against. */
export function Ruler({ trackRef, ticks, display, toUnit, onPointerDown }: RulerProps): ReactElement {
  return (
    <div className={s.ruler} ref={trackRef} data-band-ruler="" onPointerDown={onPointerDown}>
      {ticks?.map((tick, i) => (
        <span
          key={i}
          className={s.tick}
          data-tick-at={tick.at}
          style={{ '--be-at': pct(toUnit(tick.at)) } as CSSProperties}
        >
          {(tick.label !== undefined || display !== undefined) && (
            <span className={s.tickLabel}>{tick.label ?? qty(tick.at, display).text}</span>
          )}
        </span>
      ))}
    </div>
  );
}
