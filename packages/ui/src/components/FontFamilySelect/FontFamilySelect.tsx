import { listCanvasFonts, listFonts, resolveFontVariant } from '@weasel-js/font';
import { Select } from '../Select';

/** Props for {@link FontFamilySelect}. */
export interface FontFamilySelectProps {
  /** Current family, or `undefined` when the sources disagree (`mixed`). */
  value?: string;
  /** Indeterminate presentation — the aggregated sources name different families. */
  mixed?: boolean;
  onChange: (family: string) => void;
  /** The weight / style the text actually renders at, so the substitution
   *  probe reports the variant that paints rather than a nominal 400/normal. */
  weight?: number;
  fontStyle?: 'normal' | 'italic';
  /** The picker shows its value and opens nothing. */
  isDisabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Label for a value that isn't in the registry: name the substitute when the
 *  fallback chain found one, otherwise say only what is known. */
function unregisteredLabel(family: string, weight: number, style: 'normal' | 'italic'): string {
  const { substituted } = resolveFontVariant(family, weight, style);
  return substituted
    ? `${family} — not loaded, showing ${substituted.resolved}`
    : `${family} — not loaded`;
}

/**
 * Font-family picker driven by the live font registry.
 *
 * **What it offers.** Both tiers that can actually paint: `listFonts()` for
 * families with a baked atlas, and `listCanvasFonts()` for families the
 * dynamic canvas-SDF tier will serve.
 *
 * **What it does with a value it can't offer.** Nothing about the model
 * stops a node from naming a family that was never registered. The control
 * keeps that value visible as its own entry and names what is actually
 * painting instead. Dropping the value would silently rewrite the document on
 * the next edit; showing it bare would claim a font is in use that isn't.
 */
export function FontFamilySelect(props: FontFamilySelectProps) {
  const { value, mixed = false, onChange, weight = 400, fontStyle = 'normal', className } = props;
  const baked = listFonts();
  const canvas = listCanvasFonts().filter((c) => !baked.some((f) => f.family === c.family));
  const available = [...baked.map((f) => f.family), ...canvas.map((c) => c.family)];
  const options = available.map((family) => ({ value: family, label: family }));
  if (value !== undefined && !available.includes(value)) {
    options.push({ value, label: unregisteredLabel(value, weight, fontStyle) });
  }
  return (
    <Select<string>
      className={className}
      options={options}
      selectedKey={value ?? null}
      mixed={mixed}
      isDisabled={props.isDisabled}
      onSelectionChange={onChange}
      aria-label={props['aria-label'] ?? 'Font'}
    />
  );
}
