import { getOwn } from '@weasel-js/registry';
import { serializeTokenValue, type AxisChoice, type ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { inferTokenType, type TokenEntry } from '@weasel-js/ui/components/TokenPanel';
import { leafAt, ownTokenNames, pinApplies, type LayerId } from './model';

const seedText = (v: string | number) => (typeof v === 'string' ? v : String(v));

/** `emitManifest` groups a token by its name up to the first hyphen. */
const groupOf = (name: string) => name.split('-')[0] ?? name;

/**
 * A layer's tokens as `TokenPanel` edits them.
 *
 * The value is the one a pin writes back, not the one the read-only list draws:
 * a pinned alpha reads `{fg}` here rather than `{fg} at 10%`, because the field's
 * contents go straight into the pin and the percentage would land in the value.
 * A seed that varies by axis shows its value at `selection`, the one an edit writes;
 * one with no value there is left out, as a pin that does not apply is.
 */
export function layerEntries(layer: LayerId, def: ThemeDefinition, result: DeriveResult, selection: AxisChoice): TokenEntry[] {
  if (layer === 'seeds') {
    return Object.entries(def.seeds ?? {}).flatMap(([name, v]) => {
      const leaf = leafAt(v, selection);
      if (typeof leaf !== 'string' && typeof leaf !== 'number') return [];
      return [{ name: `seeds.${name}`, type: inferTokenType(seedText(leaf)), group: 'seeds', value: seedText(leaf) }];
    });
  }
  const names =
    layer === 'pins'
      ? Object.keys(def.pins ?? {}).filter((n) => pinApplies(result, n))
      : ownTokenNames(def).filter((n) => getOwn(result.provenance, n)?.layer === layer);
  return names.flatMap((name) => {
    const token = getOwn(result.tokens, name);
    if (!token) return [];
    const p = getOwn(result.provenance, name)!;
    return [{
      name,
      type: token.type,
      group: groupOf(name),
      value: serializeTokenValue(token.type, token.value),
      // A pin is itself the override; in any other layer only one that replaced a generated value is.
      overridden: layer === 'pins' || (p.pinned === true && p.generated !== undefined),
    }];
  });
}
