import type { ConfigRule, ConfigRuleContext, LeafPatch } from './types';

/** `cellSize` -> `Cell size`. Splits camelCase without shattering acronyms. */
export function titleCase(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .split(/(?<=[a-z0-9])(?=[A-Z])/)
    .join(' ')
    .trim()
    .toLowerCase();
  return words.length === 0 ? words : words[0].toUpperCase() + words.slice(1);
}

/** An `f.value` leaf takes its kind from the shape of its default. */
const kindFromValue: ConfigRule = (ctx) => {
  const t = typeof ctx.default;
  if (t === 'boolean' || t === 'number' || t === 'string') return { kind: t };
  return null;
};

const labelFromKey: ConfigRule = (ctx) => ({ name: titleCase(ctx.key) });

/** A number bounded on both sides is a slider; one bound or none is an input. */
const sliderWhenBounded: ConfigRule = (ctx) => {
  if (ctx.leaf.kind !== 'number') return null;
  const bounded = ctx.leaf.min !== undefined && ctx.leaf.max !== undefined;
  return bounded ? { control: 'slider' } : null;
};

/** `PrefBase.description` is required, so every leaf must end up with one. */
const descriptionDefault: ConfigRule = () => ({ description: '' });

/**
 * labkit's own inference, expressed in the same vocabulary a consumer
 * extends. Runs after the consumer's rules, so a lab always wins.
 *
 * If one of these ever needs something a `ConfigRule` cannot express, the
 * seam is too weak — that is the point of writing them this way.
 */
export const builtinRules: readonly ConfigRule[] = [
  kindFromValue,
  labelFromKey,
  sliderWhenBounded,
  descriptionDefault,
];

/**
 * Fold a rule chain into one leaf patch. Gap-filling: a property already
 * settled is never overwritten, so the accumulator seeded with the author's
 * annotations beats every rule, and earlier rules beat later ones.
 */
export function applyRules(
  seed: LeafPatch,
  ctx: Omit<ConfigRuleContext, 'leaf'>,
  rules: readonly ConfigRule[],
): LeafPatch {
  const acc: LeafPatch = { ...seed };
  for (const rule of rules) {
    const patch = rule({ ...ctx, leaf: acc });
    if (patch === null) continue;
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && acc[k as keyof LeafPatch] === undefined) {
        (acc as Record<string, unknown>)[k] = v;
      }
    }
  }
  return acc;
}
