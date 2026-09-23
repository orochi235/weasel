import { mergeAxes, type AxisDef, type AxisDefs, type Selection, type Varying } from './axes';
import { AXES_EXT, overrideKey, type DtcgAxesExtension } from './dtcg/axesExtension';
import { flattenTokens } from './dtcg/flatten';
import type { FlatTokens, RawToken } from './dtcg/types';
import { themeAxes } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

interface DtcgDocument {
  name?: unknown;
  defaultMode?: unknown;
  extends?: Theme | null;
  primitives?: Record<string, unknown>;
  modes?: Record<string, Record<string, unknown>>;
  $extensions?: Record<string, unknown>;
}

interface Layer {
  readonly primitives: FlatTokens;
  readonly modes: Record<string, FlatTokens>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readLayer(src: { primitives?: unknown; modes?: unknown }): Layer {
  const modes = isRecord(src.modes) ? src.modes : {};
  return {
    primitives: flattenTokens(isRecord(src.primitives) ? src.primitives : {}),
    modes: Object.fromEntries(Object.entries(modes).map(([m, g]) => [m, flattenTokens(isRecord(g) ? g : {})])),
  };
}

function readAxesExtension(raw: unknown): DtcgAxesExtension | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || !isRecord(raw.axes)) throw new Error(`DTCG "$extensions.${AXES_EXT}" needs an "axes" object`);
  return {
    axes: raw.axes as AxisDefs,
    varies: (isRecord(raw.varies) ? raw.varies : {}) as DtcgAxesExtension['varies'],
    overrides: (isRecord(raw.overrides) ? raw.overrides : {}) as DtcgAxesExtension['overrides'],
  };
}

/**
 * Build a `Theme` from a DTCG document — the interchange path, for tokens
 * exported by a design tool rather than authored in TS. A token a mode leaves
 * out takes the document's primitive of the same name, or else the base theme's.
 * Axes besides mode come from `$extensions["com.weasel.axes"]`, the encoding
 * `toDTCG` writes; a document without it loads with mode as its only axis.
 */
export function loadDTCG(doc: DtcgDocument): Theme {
  if (typeof doc.name !== 'string' || doc.name === '') {
    throw new Error('DTCG document needs a string "name"');
  }
  const base = doc.extends === undefined ? weaselTheme : doc.extends;
  const ext = readAxesExtension(doc.$extensions?.[AXES_EXT]);
  const plain = readLayer(doc);
  const overrides = Object.fromEntries(Object.entries(ext?.overrides ?? {}).map(([k, l]) => [k, readLayer(l)]));
  const modeNames = [...new Set([plain, ...Object.values(overrides)].flatMap((l) => Object.keys(l.modes)))];

  /** A token's value within one layer: varying by mode if any mode names it. */
  const tokenIn = (layer: Layer, name: string): Varying<RawToken> | undefined => {
    if (!modeNames.some((m) => layer.modes[m]?.[name])) return layer.primitives[name];
    const branch: Record<string, unknown> = { by: 'mode' };
    for (const m of modeNames) {
      const t = layer.modes[m]?.[name] ?? layer.primitives[name];
      if (t) branch[m] = t;
    }
    return branch as Varying<RawToken>;
  };

  const inherited = base ? themeAxes(base).mode?.default : undefined;
  const defaultMode = typeof doc.defaultMode === 'string' ? doc.defaultMode : (ext?.axes.mode?.default ?? inherited ?? 'dark');
  const modeAxis: AxisDef = {
    default: defaultMode,
    values: Object.fromEntries(modeNames.map((m) => [m, ext?.axes.mode?.values[m] ?? {}])),
  };
  const axes: Record<string, AxisDef> = {};
  for (const [name, def] of Object.entries(ext?.axes ?? { mode: modeAxis })) {
    if (name !== 'mode') axes[name] = def;
    else if (modeNames.length > 0) axes.mode = modeAxis;
  }
  if (modeNames.length > 0) axes.mode ??= modeAxis;
  const all = mergeAxes(base ? themeAxes(base) : {}, axes);

  /** Rebuild a token's tree over the axes it varies by, one override layer per leaf. */
  const nest = (name: string, vary: readonly string[], combo: Selection): Varying<RawToken> | undefined => {
    if (vary.length === 0) {
      const key = overrideKey(all, combo);
      const layer = key === '' ? plain : overrides[key];
      return layer && tokenIn(layer, name);
    }
    const [axis, ...rest] = vary;
    const out: Record<string, unknown> = { by: axis };
    let any = false;
    for (const value of Object.keys(all[axis].values)) {
      const v = nest(name, rest, { ...combo, [axis]: value });
      if (v !== undefined) {
        out[value] = v;
        any = true;
      }
    }
    return any ? (out as Varying<RawToken>) : undefined;
  };

  const tokens: Record<string, Varying<RawToken>> = {};
  const names = new Set([...Object.keys(plain.primitives), ...modeNames.flatMap((m) => Object.keys(plain.modes[m] ?? {}))]);
  for (const name of Object.keys(ext?.varies ?? {})) names.add(name);
  for (const name of names) {
    const vary = (ext?.varies[name] ?? []).filter((a) => a in all);
    const v = vary.length > 0 ? nest(name, vary, {}) : tokenIn(plain, name);
    if (v !== undefined) tokens[name] = v;
  }

  return { name: doc.name, extends: base, axes, tokens };
}
