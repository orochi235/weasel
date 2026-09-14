import type { AxisDefs, Varying } from './axes';
import { flattenTokens } from './dtcg/flatten';
import type { RawToken } from './dtcg/types';
import { themeAxes } from './resolveTheme';
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
 * exported by a design tool rather than authored in TS. A token a mode leaves
 * out takes the document's primitive of the same name, or else the base theme's.
 */
export function loadDTCG(doc: DtcgDocument): Theme {
  if (typeof doc.name !== 'string' || doc.name === '') {
    throw new Error('DTCG document needs a string "name"');
  }
  const base = doc.extends === undefined ? weaselTheme : doc.extends;
  const primitives = flattenTokens(doc.primitives ?? {});
  const modeNames = Object.keys(doc.modes ?? {});
  const modes = Object.fromEntries(modeNames.map((m) => [m, flattenTokens(doc.modes![m])]));

  const tokens: Record<string, Varying<RawToken>> = { ...primitives };
  for (const name of new Set(modeNames.flatMap((m) => Object.keys(modes[m])))) {
    const branch: Record<string, unknown> = { by: 'mode' };
    for (const m of modeNames) {
      const t = modes[m][name] ?? primitives[name];
      if (t) branch[m] = t;
    }
    tokens[name] = branch as Varying<RawToken>;
  }

  const inherited = base ? themeAxes(base).mode?.default : undefined;
  const defaultMode = typeof doc.defaultMode === 'string' ? doc.defaultMode : (inherited ?? 'dark');
  const axes: AxisDefs =
    modeNames.length > 0
      ? { mode: { default: defaultMode, values: Object.fromEntries(modeNames.map((m) => [m, {}])) } }
      : {};
  return { name: doc.name, extends: base, axes, tokens };
}
