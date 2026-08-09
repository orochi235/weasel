import { ALPHA_EXT, type FlatTokens, type RawToken, type TokenValue } from './types';

interface DtcgToken {
  $value: TokenValue;
  $type?: string;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

const isToken = (v: unknown): v is DtcgToken =>
  typeof v === 'object' && v !== null && '$value' in v;

/**
 * Collapse a DTCG document into flat token names.
 *
 * Groups exist only to carry `$type`; they contribute nothing to the name, so
 * `color.fg-muted` becomes `fg-muted` and in turn `--wzl-fg-muted`. This shape
 * is forced by the token set: `--wzl-accent` and `--wzl-accent-base` are both
 * real tokens, and DTCG forbids a token that is also a group.
 */
export function flattenTokens(doc: Record<string, unknown>): FlatTokens {
  const out: FlatTokens = {};

  for (const [groupName, group] of Object.entries(doc)) {
    if (groupName.startsWith('$')) continue;
    if (typeof group !== 'object' || group === null) continue;

    const g = group as Record<string, unknown> & { $type?: string };
    const groupType = g.$type;

    for (const [leaf, node] of Object.entries(g)) {
      if (leaf.startsWith('$')) continue;
      if (!isToken(node)) continue;

      const type = node.$type ?? groupType;
      if (!type) {
        throw new Error(`Token "${leaf}" has no $type and its group "${groupName}" declares none`);
      }
      if (leaf in out) {
        throw new Error(`Duplicate token name "${leaf}" — leaf keys must be unique across type groups`);
      }

      const alphaRaw = node.$extensions?.[ALPHA_EXT];
      const token: RawToken = {
        type,
        value: node.$value,
        alpha: typeof alphaRaw === 'number' ? alphaRaw : undefined,
        description: node.$description,
      };
      out[leaf] = token;
    }
  }

  return out;
}
