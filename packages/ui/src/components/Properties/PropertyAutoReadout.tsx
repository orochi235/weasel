import type { ReactNode } from 'react';
import s from './Properties.module.css';

/** An auto row's readout naming the value it came to, `auto · 12`: the word as an auto row reads it, the
 *  value as a value. Pass it as the row's `readout`. */
export function PropertyAutoReadout({ value }: { value: ReactNode }) {
  return (
    <span className={s.readoutGroup}>
      <span className={`${s.readoutText} ${s.autoReadout}`}>
        <span className={s.autoWord}>auto</span>
        <span className={s.autoReadoutSep}> · </span>
        {value}
      </span>
    </span>
  );
}
