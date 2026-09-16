import { serializeTokenValue, type ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { inferTokenType, type TokenEntry } from '@weasel-js/ui';
import { ownTokenNames, pinApplies, type LayerId } from './model';

/** A seed is a number or a string, or varies by axis — which only JSON shows. */
const seedText = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : JSON.stringify(v);

/** `emitManifest` groups a token by its name up to the first hyphen. */
const groupOf = (name: string) => name.split('-')[0] ?? name;

/**
 * A layer's tokens as `TokenPanel` edits them.
 *
 * The value is the one a pin writes back, not the one the read-only list draws:
 * a pinned alpha reads `{fg}` here rather than `{fg} at 10%`, because the field's
 * contents go straight into the pin and the percentage would land in the value.
 */
export function layerEntries(layer: LayerId, def: ThemeDefinition, result: DeriveResult): TokenEntry[] {
  if (layer === 'seeds') {
    return Object.entries(def.seeds ?? {}).map(([name, v]) => ({
      name: `seeds.${name}`,
      type: inferTokenType(seedText(v)),
      group: 'seeds',
      value: seedText(v),
    }));
  }
  const names =
    layer === 'pins'
      ? Object.keys(def.pins ?? {}).filter((n) => pinApplies(result, n))
      : ownTokenNames(def).filter((n) => result.provenance[n]?.layer === layer);
  return names
    .filter((name) => Object.hasOwn(result.tokens, name))
    .map((name) => {
      const token = result.tokens[name];
      const p = result.provenance[name];
      return {
        name,
        type: token.type,
        group: groupOf(name),
        value: serializeTokenValue(token.type, token.value),
        // A pin is itself the override; in any other layer only one that replaced a generated value is.
        overridden: layer === 'pins' || (p.pinned === true && p.generated !== undefined),
      };
    });
}
