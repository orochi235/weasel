import type { PrefLeaf } from '@weasel-js/prefs';
import {
  CurveField,
  PropertyRow,
  type PropertyRowProps,
} from '@weasel-js/ui/components/Properties';
import { extra } from './fields';

/** An `f.curve` leaf's row: its label over a `CurveField` as wide as the panel. A drag sends its moves through
 *  `draft`, where given, and writes the curve it settles on once. */
export function CurveRow({
  leaf,
  value,
  write,
  draft,
  disabled,
  row,
}: {
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  draft: ((value: unknown) => void) | undefined;
  disabled: boolean;
  row: Omit<PropertyRowProps, 'children'>;
}) {
  const fallback = (leaf as { default?: unknown }).default;
  const values = Array.isArray(value)
    ? (value as number[])
    : Array.isArray(fallback)
      ? (fallback as number[])
      : [];
  return (
    <PropertyRow {...row} layout="block" span group disabled={disabled}>
      <CurveField
        values={values}
        min={extra<number>(leaf, 'min') ?? 0}
        max={extra<number>(leaf, 'max') ?? 1}
        step={extra<number>(leaf, 'step') ?? 0.01}
        defaults={Array.isArray(fallback) ? (fallback as number[]) : undefined}
        onChange={write}
        {...(draft ? { onInput: draft } : {})}
        disabled={disabled}
      />
    </PropertyRow>
  );
}
