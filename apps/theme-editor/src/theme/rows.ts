import type { ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { ownTokenNames, type LayerId } from './model';

export interface TokenRow {
  readonly name: string;
  readonly type: string;
  readonly value: string;
  /** What the rule produced before a pin replaced it. */
  readonly replaced?: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export function layerRows(layer: LayerId, def: ThemeDefinition, result: DeriveResult): TokenRow[] {
  if (layer === 'seeds') {
    return Object.entries(def.seeds ?? {}).map(([name, v]) => ({ name: `seeds.${name}`, type: 'seed', value: text(v) }));
  }
  const names = layer === 'pins' ? Object.keys(def.pins ?? {}) : ownTokenNames(def).filter((n) => result.provenance[n]?.layer === layer);
  return names
    .filter((name) => Object.hasOwn(result.tokens, name))
    .map((name) => {
      const token = result.tokens[name];
      const p = result.provenance[name];
      return { name, type: token.type, value: text(token.value), ...(p.pinned && p.generated ? { replaced: text(p.generated.value) } : {}) };
    });
}
