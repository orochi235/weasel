/**
 * Font-weight picker for one family, driven by the live font registry.
 *
 * It offers the weights `listFontWeights` reports for `family` — the faces
 * that will actually paint rather than be faked. A family with none on file
 * (the canvas tier, which rasterizes any weight it is asked for, or no family
 * at all because the selection spans several) gets the nine CSS weights. A
 * value outside the list is kept as its own entry, as `FontFamilySelect` keeps
 * an unregistered family: dropping it would rewrite the text on the next edit.
 */
import { listFontWeights } from '@weasel-js/font';
import { Select } from '../Select';

export interface FontWeightSelectProps {
  /** Current weight, or `undefined` when the sources disagree (`mixed`). */
  value?: number;
  /** Indeterminate presentation — the aggregated sources differ in weight. */
  mixed?: boolean;
  /** The family whose weights to offer. Absent offers the CSS weights. */
  family?: string;
  onChange: (weight: number) => void;
  'aria-label'?: string;
  className?: string;
}

const CSS_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const NAMES: Readonly<Record<number, string>> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

/** A weight as the picker lists it: the number, then its common name. */
export function fontWeightLabel(weight: number): string {
  const name = NAMES[weight];
  return name ? `${weight} ${name}` : String(weight);
}

export function FontWeightSelect(props: FontWeightSelectProps) {
  const { value, mixed = false, family, onChange, className } = props;
  const registered = family === undefined ? [] : listFontWeights(family);
  const weights = new Set<number>(registered.length > 0 ? registered : CSS_WEIGHTS);
  if (value !== undefined && !mixed) weights.add(value);
  const options = [...weights]
    .sort((a, b) => a - b)
    .map((w) => ({ value: String(w), label: fontWeightLabel(w) }));
  return (
    <Select<string>
      className={className}
      options={options}
      selectedKey={mixed || value === undefined ? null : String(value)}
      placeholder={mixed ? 'Mixed' : undefined}
      onSelectionChange={(key) => onChange(Number(key))}
      aria-label={props['aria-label'] ?? 'Weight'}
    />
  );
}
