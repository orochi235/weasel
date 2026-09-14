import { isByAxis, type AxisDefs, type Varying } from './axes';
import type { PinObject, PinValue, ThemeDefinition } from './definition';
import type { RawToken, TokenValue } from './dtcg/types';
import { BAKED_THEMES } from './generated/themes';

/**
 * A theme ready to resolve: its axes and its tokens, each plain or varying by
 * axis, references intact. A `by` that leaves a value out contributes nothing
 * for that selection, so the theme it extends supplies it.
 */
export interface Theme {
  readonly name: string;
  readonly extends: Theme | null;
  readonly axes: AxisDefs;
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
}

/** What `defineTheme` accepts: a definition whose `extends` is a `Theme`, holding pins and components only. */
export type ThemeInput = Omit<ThemeDefinition, 'extends'> & { readonly extends?: Theme | null };

const isPinObject = (v: PinValue): v is PinObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

function toRaw(v: Varying<PinValue>): Varying<RawToken> {
  if (isByAxis(v)) {
    const out: Record<string, unknown> = { by: v.by };
    for (const [k, x] of Object.entries(v)) if (k !== 'by') out[k] = toRaw(x as Varying<PinValue>);
    return out as Varying<RawToken>;
  }
  const obj: PinObject = isPinObject(v) ? v : { value: v as TokenValue };
  return { type: obj.type ?? 'unknown', value: obj.value, alpha: obj.alpha, description: obj.description };
}

/** The built-in theme, from the baked output of themes/weasel.json. */
export const weaselTheme: Theme = {
  name: 'weasel',
  extends: null,
  axes: BAKED_THEMES.weasel.axes,
  tokens: BAKED_THEMES.weasel.tokens,
};

/**
 * Build a theme from pins. Unless `extends` says otherwise the result layers
 * onto `weaselTheme`, so a theme only names what it changes. A definition with
 * seeds, ramps, scales or semantics needs deriving first.
 */
export function defineTheme(input: ThemeInput): Theme {
  if (typeof input.extends === 'string') {
    throw new Error(
      `Theme "${input.name}" extends "${input.extends}" by name; defineTheme needs the Theme itself (e.g. weaselTheme), not a definition's name.`,
    );
  }
  const rules = (['seeds', 'ramps', 'scales', 'semantics'] as const).filter((k) => Object.keys(input[k] ?? {}).length > 0);
  if (rules.length > 0) {
    throw new Error(
      `Theme "${input.name}" has ${rules.join(', ')}, which need deriving. Bake it with \`bake\` from @weasel-js/theme/engine.`,
    );
  }
  const tokens: Record<string, Varying<RawToken>> = {};
  for (const [name, v] of Object.entries({ ...input.components, ...input.pins })) tokens[name] = toRaw(v);
  return {
    name: input.name,
    extends: input.extends === undefined ? weaselTheme : input.extends,
    axes: input.axes ?? {},
    tokens,
  };
}
