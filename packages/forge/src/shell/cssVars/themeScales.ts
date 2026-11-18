import { refitScale, type TokenScale, type TokenScaleRule } from '@weasel-js/labkit';
import { THEME_SOURCES, TOKEN_MANIFEST } from '@weasel-js/theme';
import { scale as generateScale } from '@weasel-js/theme/engine';
import { getOwn, setOwn } from '@weasel-js/registry';
import { THEME_NAME, TOKEN_PREFIX, type UnsavedScale } from './useThemeSave';

const MANIFEST = new Map(TOKEN_MANIFEST.map((token) => [token.name, token]));

interface ScaleSource {
  readonly name: string;
  readonly group: string;
  readonly steps: readonly string[];
  readonly tokens: readonly string[];
  /** The definition's rule, or its kind alone when a parameter is a reference or varies by axis. */
  readonly rule: TokenScaleRule | TokenScaleRule['kind'];
}

const literal = (v: unknown): v is number => typeof v === 'number';

/** The weasel theme's scales, as the panel can regenerate them. */
const SCALE_SOURCES: readonly ScaleSource[] = Object.entries(THEME_SOURCES[THEME_NAME]?.scales ?? {}).flatMap(([name, def]) => {
  if (!Array.isArray(def.steps)) return [];
  const steps = def.steps as readonly string[];
  const tokens = steps.map((step) => `${TOKEN_PREFIX}${name}-${step}`);
  const group = MANIFEST.get(tokens[0] ?? '')?.group;
  if (!group) return [];
  const factors = Array.isArray(def.factors) && def.factors.every(literal) ? (def.factors as number[]) : null;
  const rule: ScaleSource['rule'] =
    def.factors !== undefined
      ? factors
        ? { kind: 'factors', factors }
        : 'factors'
      : def.ratio !== undefined
        ? literal(def.ratio)
          ? { kind: 'ratio', ratio: def.ratio }
          : 'ratio'
        : literal(def.step)
          ? { kind: 'step', step: def.step }
          : 'step';
  return [{ name, group, steps, tokens, rule }];
});

/** Each of the tokens of `group`'s scale and the value `next` gives it, or `undefined` when the theme has no such scale. */
export function scaleValuesFor(group: string, next: TokenScale): [string, string][] | undefined {
  const source = SCALE_SOURCES.find((sc) => sc.group === group);
  return source && scaleValues(source, next);
}

/** Each of a scale's tokens and the value `next` gives it. */
function scaleValues(source: ScaleSource, next: TokenScale): [string, string][] {
  const { rule } = next;
  const values = generateScale(source.steps, {
    base: next.base,
    ...(rule.kind === 'factors' ? { factors: rule.factors } : rule.kind === 'ratio' ? { ratio: rule.ratio } : { step: rule.step }),
  });
  return source.steps.flatMap((step, i) => {
    const value = getOwn(values, step);
    const name = source.tokens[i];
    return value !== undefined && name !== undefined ? [[name, value]] : [];
  });
}

/** A scale as its steps stand: the definition's rule, with the base read back from the values the frame reports. */
function standingScale(source: ScaleSource, amounts: readonly number[]): TokenScale {
  const seed: TokenScale = { tokens: source.tokens, base: amounts[0] ?? 0, rule: { kind: 'step', step: 0 } };
  if (typeof source.rule === 'string') return refitScale(seed, source.rule, amounts);
  const { rule } = source;
  if (rule.kind !== 'factors') return { ...seed, rule };
  // The step nearest ×1 carries the least rounding back into the base.
  let at = 0;
  rule.factors.forEach((f, i) => {
    if (Math.abs(f - 1) < Math.abs((rule.factors[at] ?? 1) - 1)) at = i;
  });
  const base = (amounts[at] ?? 0) / (rule.factors[at] ?? 1);
  return { ...seed, base: Math.round(base * 100) / 100, rule };
}

/**
 * The scale each group shows, given the values its tokens show: its edit while any of its steps is overridden,
 * otherwise the scale its steps stand at. A scale with a step that shows no number is left out.
 */
export function scalesFor(
  values: ReadonlyMap<string, string>,
  overrides: Readonly<Record<string, string>>,
  edited: Readonly<Record<string, TokenScale>>,
): Record<string, TokenScale> {
  const out: Record<string, TokenScale> = {};
  for (const source of SCALE_SOURCES) {
    const amounts = source.tokens.map((name) => Number.parseFloat(values.get(name) ?? ''));
    if (amounts.some(Number.isNaN)) continue;
    const own = source.tokens.some((name) => getOwn(overrides, name) !== undefined) ? getOwn(edited, source.group) : undefined;
    setOwn(out, source.group, own ?? standingScale(source, amounts));
  }
  return out;
}

/**
 * The edited scales a save writes, each with the steps that still hold what its edit generated. A step edited by hand
 * after its scale is left to be pinned over the scale. A scale with a step reset to the theme's value is not saved,
 * since the step would then show the edit's value where the trial showed the theme's.
 */
export function unsavedScales(edited: Readonly<Record<string, TokenScale>>, overrides: Readonly<Record<string, string>>): UnsavedScale[] {
  return SCALE_SOURCES.flatMap((source): UnsavedScale[] => {
    const edit = getOwn(edited, source.group);
    if (!edit || !source.tokens.every((name) => getOwn(overrides, name) !== undefined)) return [];
    const { name, group } = source;
    const tokens = scaleValues(source, edit).filter(([token, value]) => getOwn(overrides, token) === value).map(([token]) => token);
    return [{ name, group, tokens, edit: { base: edit.base, rule: edit.rule } }];
  });
}
