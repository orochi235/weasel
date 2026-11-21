import { useFontFamilyOptions, useFontWeightOptions } from '../FontOptions';
import { Select } from '../Select';
import type { PropertyFontFamilyFieldProps, PropertyFontWeightFieldProps } from './fieldTypes';

export function FontFamilyControl(p: PropertyFontFamilyFieldProps) {
  const value = p.mixed || p.unset ? undefined : p.value;
  const options = useFontFamilyOptions({ value, weight: p.weight, fontStyle: p.fontStyle });
  return (
    <Select<string>
      className={p.className}
      options={options}
      selectedKey={value ?? null}
      placeholder={p.unset ? '—' : undefined}
      mixed={p.mixed}
      disabled={p.disabled}
      disabledReason={p.disabledReason}
      onSelectionChange={p.onChange}
      aria-label={p.name}
    />
  );
}

export function FontWeightControl(p: PropertyFontWeightFieldProps) {
  const value = p.mixed || p.unset ? undefined : p.value;
  const options = useFontWeightOptions({ family: p.family, value });
  return (
    <Select<string>
      className={p.className}
      options={options}
      selectedKey={value === undefined ? null : String(value)}
      placeholder={p.unset ? '—' : undefined}
      mixed={p.mixed}
      disabled={p.disabled}
      disabledReason={p.disabledReason}
      onSelectionChange={(key) => p.onChange(Number(key))}
      aria-label={p.name}
    />
  );
}
