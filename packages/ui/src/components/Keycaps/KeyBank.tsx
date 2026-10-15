import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { KeyBankContext, type KeyBankContextValue } from './keyBankContext';
import s from './Keycaps.module.css';
import { KEY_MIN_SCALE, KEY_SPELLINGS, resolveBankScales, type BankMember, type KeySpellings } from './legendFit';

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
  const members = useRef(new Map<string, BankMember>());
  const [scale, setScale] = useState<number | null>(null);

  const report = useCallback((id: string, member: BankMember | null) => {
    if (member) members.current.set(id, member);
    else members.current.delete(id);
    const list = [...members.current.values()];
    const single = list.findIndex((m) => !m.wrapped);
    setScale(single < 0 ? null : Math.round(resolveBankScales(list, minScale)[single]! * 1000) / 1000);
  }, [minScale]);

  const value = useMemo<KeyBankContextValue>(
    () => ({ wrap, spellings, minScale, report }),
    [wrap, spellings, minScale, report],
  );
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
