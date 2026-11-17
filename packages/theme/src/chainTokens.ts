import { setOwn } from '@weasel-js/registry';
import { fullAxisChoice, mergeAxes, pick, type AxisDefs, type AxisChoice, type Varying } from './axes.ts';
import type { FlatTokens, RawToken } from './dtcg/types.ts';

/** One theme of an `extends` chain, as far as choosing its tokens goes. */
export interface ChainLink {
  readonly axes: AxisDefs;
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
}

/**
 * The selection each theme of a root-first chain reads its own tokens at. An axis value a theme and
 * everything it extends never declared (one a descendant added) becomes that theme's default for the
 * axis, which is what the stylesheet's cascade gives it: no block of the ancestor matches the new
 * value, so its default declarations show through.
 */
function localAxisChoices(chain: readonly ChainLink[], selection: AxisChoice): AxisChoice[] {
  let axes: AxisDefs = {};
  return chain.map((link) => {
    axes = mergeAxes(axes, link.axes);
    return { ...selection, ...fullAxisChoice(axes, selection) };
  });
}

/** `name` from the nearest theme of a root-first chain that has it at `selection`. */
export function tokenAt(chain: readonly ChainLink[], name: string, selection: AxisChoice): RawToken | undefined {
  const local = localAxisChoices(chain, selection);
  for (let i = chain.length - 1; i >= 0; i--) {
    const { tokens } = chain[i];
    if (!Object.hasOwn(tokens, name)) continue;
    const picked = pick(tokens[name], local[i]);
    if (picked.ok) return picked.value;
  }
  return undefined;
}

/** Every token of a root-first chain at `selection`, each from the nearest theme that has it there. */
export function tokensAt(chain: readonly ChainLink[], selection: AxisChoice): FlatTokens {
  const local = localAxisChoices(chain, selection);
  const out: Record<string, RawToken> = {};
  chain.forEach((link, i) => {
    for (const [name, v] of Object.entries(link.tokens)) {
      const picked = pick(v, local[i]);
      if (picked.ok) setOwn(out, name, picked.value);
    }
  });
  return out;
}
