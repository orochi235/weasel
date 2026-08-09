import { flattenTokens } from './dtcg/flatten';
import type { FlatTokens } from './dtcg/types';
import { weaselTheme, type Theme } from './theme';

interface DtcgDocument {
  name?: unknown;
  defaultMode?: unknown;
  extends?: Theme | null;
  primitives?: Record<string, unknown>;
  modes?: Record<string, Record<string, unknown>>;
}

/**
 * Build a `Theme` from a DTCG document — the interchange path, for tokens
 * exported by a design tool rather than authored in TS.
 */
export function loadDTCG(doc: DtcgDocument): Theme {
  if (typeof doc.name !== 'string' || doc.name === '') {
    throw new Error('DTCG document needs a string "name"');
  }
  const modes: Record<string, FlatTokens> = {};
  for (const [mode, body] of Object.entries(doc.modes ?? {})) {
    modes[mode] = flattenTokens(body);
  }
  const base = doc.extends === undefined ? weaselTheme : doc.extends;
  return {
    name: doc.name,
    extends: base,
    defaultMode:
      typeof doc.defaultMode === 'string' ? doc.defaultMode : (base?.defaultMode ?? 'dark'),
    tokens: flattenTokens(doc.primitives ?? {}),
    modes,
  };
}
