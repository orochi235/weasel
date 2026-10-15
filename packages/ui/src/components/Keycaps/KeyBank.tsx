import { useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { BankFitter } from './bankFitter';
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
 */
export function KeyBank({ children, wrap = false, spellings = KEY_SPELLINGS, minScale = KEY_MIN_SCALE, className }: KeyBankProps) {
  const [scale, setScale] = useState<number | null>(null);
  const [fitter] = useState(() => new BankFitter(setScale));

  useLayoutEffect(() => {
    fitter.attach();
    return () => fitter.detach();
  }, [fitter]);
  useLayoutEffect(() => fitter.configure(spellings, minScale), [fitter, spellings, minScale]);
  // Members join in their own layout effects, which run before this one, so
  // a commit's keys are all measured here in one pass, before paint.
  useLayoutEffect(() => fitter.flush());

  const value = useMemo<KeyBankContextValue>(() => ({ wrap, minScale, fitter }), [wrap, minScale, fitter]);
  // A measured value has no static home in the stylesheet, so the scale rides
  // an inline custom property; nothing else is set inline.
  const style = scale === null ? undefined : ({ '--key-legend-scale': String(scale) } as CSSProperties);

  return (
    <KeyBankContext.Provider value={value}>
      <div className={[s.bank, className].filter(Boolean).join(' ')} style={style}>
        {children}
      </div>
    </KeyBankContext.Provider>
  );
}
