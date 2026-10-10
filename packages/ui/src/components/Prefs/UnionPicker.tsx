import type { ReactNode } from 'react';
import { prefVariantDefault, prefVariantOf, type PrefEnum, type PrefObject, type PrefUnion } from '@weasel-js/prefs';
import { PropertyControl } from '../Properties/PropertyField';
import { prefFieldProps } from './prefField';
import s from './UnionPicker.module.css';

/** Props for {@link UnionPicker}. */
export interface UnionPickerProps {
  pref: PrefUnion;
  value: unknown;
  /** Nodes whose variants differ: nothing is chosen and no fields are drawn. */
  mixed?: boolean;
  /** A variant chosen: the whole value, which is that variant's default under its tag. */
  onChange: (next: Record<string, unknown>) => void;
  /** Draws the chosen variant's fields. The value they edit keeps its tag. */
  children: (variant: PrefObject, key: string) => ReactNode;
}

/** A `union` leaf: a select of its variants, over the fields of the one its value is. */
export function UnionPicker({ pref, value, mixed = false, onChange, children }: UnionPickerProps) {
  const current = mixed ? undefined : prefVariantOf(pref, value);
  const choice: PrefEnum = {
    kind: 'enum',
    name: pref.name,
    description: '',
    default: undefined,
    clearable: true,
    control: 'select',
    options: Object.entries(pref.variants).map(([key, variant]) => ({ value: key, label: variant.name || key })),
  };
  const field = prefFieldProps(choice, {
    value: current?.[0],
    mixed,
    unset: !mixed && current === undefined,
    setValue: (key) => {
      if (typeof key === 'string') onChange(prefVariantDefault(pref, key));
    },
  });
  return (
    <div className={s.union}>
      {field && <PropertyControl {...field} name={pref.name} />}
      {current && children(current[1], current[0])}
    </div>
  );
}
