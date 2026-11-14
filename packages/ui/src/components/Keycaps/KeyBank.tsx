import { useMemo, useRef, type ReactNode } from 'react';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { KeyBankContext, type KeyBankContextValue } from './keyBankContext';
import s from './Keycaps.module.css';
import { KEY_MIN_SCALE, KEY_SPELLINGS, type KeySpellings } from './legendFit';

/** Props for {@link KeyBank}. */
export interface KeyBankProps {
  /** The keys, at any depth: every `KeyCap` inside joins the bank. */
  children?: ReactNode;
  /** Lets a key print a two-line spelling (`Pg\nUp`) when its legend would
   *  otherwise have to shrink. A `KeyCap`'s own `wrap` overrides it.
   *  Defaults to false. */
  wrap?: boolean;
  /** Other spellings each legend may take, in order of preference.
   *  Defaults to {@link KEY_SPELLINGS}. */
  spellings?: KeySpellings;
  /** How far the bank's legends may shrink before they are left to
   *  overflow. Defaults to {@link KEY_MIN_SCALE}. */
  minScale?: number;
  /** Laid out as `display: contents` unless a class says otherwise, so a
   *  bank can span rows of a layout it does not own. */
  className?: string;
}

/**
 * Groups keys that print their legends at one size, the way a keyboard's
 * function row or navigation cluster does. Each key picks the spelling that
 * fits it best; every single-line legend then prints at the smallest scale
 * any member needs, floored at `minScale`. A key on a two-line spelling sizes
 * itself. Keys outside a bank are never fitted.
 *
 * A bank is a fit scope running a scale stage (`useFitScope`'s `scale`), so a
 * `FitLabel` inside it steps as in any other scope.
 */
export function KeyBank({ children, wrap = false, spellings = KEY_SPELLINGS, minScale = KEY_MIN_SCALE, className }: KeyBankProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitScope(ref, { scale: { min: minScale, property: '--key-legend-scale' } });
  const value = useMemo<KeyBankContextValue>(() => ({ wrap, spellings }), [wrap, spellings]);
  return (
    <FitScope value={fit}>
      <KeyBankContext.Provider value={value}>
        <div ref={ref} className={[s.bank, className].filter(Boolean).join(' ')}>
          {children}
        </div>
      </KeyBankContext.Provider>
    </FitScope>
  );
}
