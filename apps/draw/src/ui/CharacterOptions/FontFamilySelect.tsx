/**
 * Font-family picker driven by the live font registry.
 *
 * **What it offers.** `listFonts()` — and only `listFonts()`. That reports
 * the baked-atlas registry: families with real metrics and a real texture,
 * which is exactly the set that is honestly available to pick. Families
 * enrolled through `registerCanvasFont` (or auto-enrolled under the
 * `'canvas'` fallback policy) are deliberately *not* listed. They live in a
 * separate set, they are *asserted* to exist in the browser rather than
 * verified, and the font package exposes no way to enumerate them
 * (`isCanvasFont` answers about one family at a time) — so the choice here
 * is between omitting them and inventing a list. They still appear as the
 * current value when something else selected one, via the unregistered-value
 * path below.
 *
 * **What it does with a value it can't offer.** Nothing about the model
 * stops a node from naming a family that was never registered — a pasted
 * node, an imported SVG, a document from a session that loaded more fonts.
 * The control keeps that value visible as its own entry and names what is
 * actually painting instead, read structurally off
 * `resolveFontVariant().substituted`. Dropping the value would silently
 * rewrite the document on the next edit; showing it bare would claim a font
 * is in use that isn't.
 */
import { listFonts, resolveFontVariant } from '@weasel-js/font';
import { Select } from '@weasel-js/ui';

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

export function FontFamilySelect(props: FontFamilySelectProps) {
  const { value, mixed = false, onChange, weight = 400, fontStyle = 'normal', className } = props;
  const registered = listFonts();
  const options = registered.map((f) => ({ value: f.family, label: f.family }));
  if (value !== undefined && !registered.some((f) => f.family === value)) {
    options.push({ value, label: unregisteredLabel(value, weight, fontStyle) });
  }
  return (
    <Select<string>
      className={className}
      options={options}
      selectedKey={mixed ? null : (value ?? null)}
      placeholder={mixed ? 'Mixed' : undefined}
      onSelectionChange={onChange}
      aria-label={props['aria-label'] ?? 'Font'}
    />
  );
}
