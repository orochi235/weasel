/**
 * Font-family picker driven by the live font registry.
 *
 * **What it offers.** Both tiers that can actually paint: `listFonts()` for
 * families with a baked atlas, and `listCanvasFonts()` for families the
 * dynamic canvas-SDF tier will serve. The rule is unchanged — offer what
 * will render, invent nothing — but the second half of it used to be
 * unreachable. Canvas-enrolled families were omitted because the font
 * package had no way to enumerate them (`isCanvasFont` answers about one
 * family at a time), leaving a choice between omitting them and hard-coding
 * a list beside the enrollment calls. `listCanvasFonts` closed that gap, and
 * it reports service rather than membership, so a family auto-enrolled under
 * a policy that is no longer in force doesn't appear.
 *
 * WeaselDraw enrolls its candidates only after `document.fonts.check`
 * confirms the machine has them (`src/fonts.ts`), so "asserted to exist"
 * is now "verified present" for everything this app contributes.
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
import { listCanvasFonts, listFonts, resolveFontVariant } from '@weasel-js/font';
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
  // Both tiers that actually render: families with a baked atlas, and
  // families the dynamic canvas-SDF tier will serve. Neither list is a guess
  // — `listCanvasFonts` reports what the registry will really route, so a
  // family reaches this menu only if it can paint.
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
      selectedKey={mixed ? null : (value ?? null)}
      placeholder={mixed ? 'Mixed' : undefined}
      onSelectionChange={onChange}
      aria-label={props['aria-label'] ?? 'Font'}
    />
  );
}
