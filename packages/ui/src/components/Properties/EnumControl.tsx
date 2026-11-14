import { type ReactNode } from 'react';
import { dlog } from '../../dlog';
import { MenuButton } from '../MenuButton';
import { Radio, RadioGroup } from '../RadioGroup';
import { Select } from '../Select';
import { MIXED_HINT } from '../mixedHint';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import { ToggleBar } from '../ToggleBar';
import type { PropertyEnumFieldProps, PropertyOption } from './fieldTypes';
import { nameOf } from './nameOf';
import s from './Properties.module.css';

/** A segment's tooltip: the option's description, else its label where a glyph hides that. */
function segmentTip(o: PropertyOption<string>): ReactNode {
  if (o.description) return o.description;
  return o.glyph === undefined || o.glyph === null ? undefined : o.label;
}

/** The key of the entry that clears a clearable enum: no option's value, which is a string a schema wrote. */
const UNSET = '\u0000unset';

/** `p.options`, led by an entry that clears the value where the field takes no value at all. */
function choices(p: PropertyEnumFieldProps): readonly PropertyOption<string>[] {
  return p.onClear ? [{ value: UNSET, label: 'Unset' }, ...p.options] : p.options;
}

/** `p.onChange`, sending the clearing entry to `p.onClear`. */
const choose = (p: PropertyEnumFieldProps) => (value: string): void => {
  if (value === UNSET) p.onClear?.();
  else p.onChange(value);
};

export function EnumControl(p: PropertyEnumFieldProps) {
  const chosen = !p.mixed && p.options.some((opt) => opt.value === p.value);
  const current = chosen ? (p.value as string) : null;

  if (p.control === 'radio') {
    return (
      <RadioGroup className={p.className} value={current ?? (p.onClear && !p.mixed ? UNSET : null)} disabled={p.disabled} disabledReason={p.disabledReason} onChange={choose(p)} aria-label={p.name}>
        {choices(p).map((o) => (
          <Radio key={o.value} value={o.value} disabled={o.disabled} description={o.description} disabledReason={o.disabledReason}>
            {o.label}
          </Radio>
        ))}
      </RadioGroup>
    );
  }
  if (p.control === 'menu') {
    const held = current === null ? undefined : p.options.find((o) => o.value === current);
    const reads = p.mixed ? MIXED_HINT : held ? held.label : (p.placeholder ?? (p.unset ? '—' : 'Choose option…'));
    // The button's text is its value, so its name has to carry both.
    const named = p.name === undefined ? undefined : typeof reads === 'string' ? `${p.name}: ${reads}` : p.name;
    return (
      <MenuButton<string>
        className={p.className}
        aria-label={named}
        label={reads}
        current={held !== undefined}
        disabled={p.disabled}
        disabledReason={p.disabledReason}
        items={choices(p).map((o) => ({
          value: o.value, label: nameOf(o.label) ?? o.short?.[0] ?? o.value, disabled: o.disabled,
          description: o.description, disabledReason: o.disabledReason,
        }))}
        onAction={choose(p)}
      />
    );
  }
  if (p.control === 'toggle') {
    return (
      <ToggleBar<string>
        size="sm"
        variant="flat"
        className={p.className ? `${s.toggleBar} ${p.className}` : s.toggleBar}
        aria-label={p.name}
        items={p.options.map((o) => ({
          value: o.value,
          label: o.glyph ?? <FitLabel forms={labelForms(o.label, o.short)} />,
          ariaLabel: nameOf(o.label),
          tooltip: segmentTip(o),
          disabled: o.disabled,
          disabledReason: o.disabledReason,
        }))}
        disabled={p.disabled}
        disabledReason={p.disabledReason}
        value={current}
        // Clearable: a click on the lit segment clears it, and the arrows move focus without choosing, so each
        // segment can show mixed. Otherwise the bar is a radio group.
        allowDeselect={p.onClear !== undefined}
        followsFocus={p.onClear === undefined}
        mixedValues={p.onClear && p.mixed ? p.options.map((o) => o.value) : undefined}
        onChange={(next) => {
          if (next !== null) p.onChange(next);
          else p.onClear?.();
        }}
      />
    );
  }
  return (
    <Select<string>
      className={p.className ? `${s.select} ${p.className}` : s.select}
      triggerId={p.id}
      disabled={p.disabled}
      disabledReason={p.disabledReason}
      aria-label={p.name}
      placeholder={p.placeholder ?? (p.unset ? '—' : 'Choose option…')}
      mixed={p.mixed}
      selectedKey={current}
      options={choices(p).map((o) => ({
        value: o.value,
        label: o.label,
        icon: o.glyph,
        disabled: o.disabled,
        description: o.description,
        disabledReason: o.disabledReason,
      }))}
      onSelectionChange={(v) => {
        dlog('property-panel', 'select', { name: p.name, value: v });
        choose(p)(v);
      }}
    />
  );
}
