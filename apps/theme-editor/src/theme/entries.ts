import { getOwn } from '@weasel-js/registry';
import { serializeTokenValue, type AxisChoice, type ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { inferTokenType, type TokenEntry } from '@weasel-js/ui/components/TokenPanel';
import { layerNames, leafAt, textTypeOf, type LayerId } from './model';

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
export function layerEntries(layer: LayerId, def: ThemeDefinition, result: DeriveResult, selection: AxisChoice, merged: ThemeDefinition): TokenEntry[] {
  if (layer === 'seeds') {
    return layerNames(layer, def, result, selection, merged).map((name) => {
      const value = seedText(leafAt(getOwn(def.seeds ?? {}, name.slice('seeds.'.length)), selection) as string | number);
      return { name, type: inferTokenType(value), group: 'seeds', value };
    });
  }
  return layerNames(layer, def, result, selection, merged).flatMap((name) => {
    const token = getOwn(result.tokens, name);
    if (!token) return [];
    const p = getOwn(result.provenance, name)!;
    return [{
      name,
      type: token.type,
      group: groupOf(name),
      value: serializeTokenValue(textTypeOf(token.type, token.value), token.value),
      // A pin is itself the override; in any other layer only one that replaced a generated value is.
      overridden: layer === 'pins' || (p.pinned === true && p.generated !== undefined),
    }];
  });
}
