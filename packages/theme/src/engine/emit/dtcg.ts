import { enumerateSelections, fullSelection, isByAxis, pick } from '../../axes';
import { AXES_EXT, overrideKey, type DtcgAxesExtension } from '../../dtcg/axesExtension';
import { ALPHA_EXT, type RawToken, type TokenValue } from '../../dtcg/types';
import { themeAxes } from '../../resolveTheme';
import type { Theme } from '../../theme';

type Group = Record<string, unknown> & { $type: string };

interface Layer {
  primitives: Record<string, Group>;
  modes: Record<string, Record<string, Group>>;
}

const REF = /^\{([^}.]+)\}$/;

export interface DtcgExport {
  readonly name: string;
  readonly defaultMode?: string;
  readonly primitives: Record<string, Group>;
  readonly modes: Record<string, Record<string, Group>>;
  readonly $extensions?: { readonly [AXES_EXT]?: DtcgAxesExtension };
}

/**
 * A theme's own tokens as a DTCG document `loadDTCG` reads back. `extends` is
 * not carried; pass it to `loadDTCG`. Every mode the chain declares is written,
 * so a token that leaves one out still falls through to the parent on the way back.
 *
 * DTCG has one variant dimension, so the plain groups hold mode, with every
 * other axis at its default value: what a tool that ignores extensions reads.
 * The other values travel under `$extensions["com.weasel.axes"]` (see
 * `DtcgAxesExtension`), one override layer per combination of non-default values
 * some token actually varies by — axes that vary independently cost one layer
 * per value, not their cross-product.
 */
export function toDTCG(theme: Theme): DtcgExport {
  const axes = themeAxes(theme);
  const defaults = fullSelection(axes);
  const nonMode = Object.keys(axes).filter((a) => a !== 'mode');
  const declaredModes = Object.keys(axes.mode?.values ?? {});

  /** The type of the nearest token named `name` in the chain; undefined when no theme has one. */
  const typeOf = (name: string): string | undefined => {
    for (let t: Theme | null = theme; t; t = t.extends) {
      if (!Object.hasOwn(t.tokens, name)) continue;
      let v: unknown = t.tokens[name];
      while (isByAxis(v)) v = Object.entries(v).find(([k]) => k !== 'by')?.[1];
      if (v !== undefined) return (v as RawToken).type;
    }
    return undefined;
  };
  /** `{name}` → `{type.name}`, the path a DTCG tool resolves. */
  const alias = (value: TokenValue): TokenValue => {
    const target = typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
    const type = target === undefined ? undefined : typeOf(target);
    return type === undefined ? value : `{${type}.${target}}`;
  };

  const put = (into: Record<string, Group>, name: string, t: RawToken) => {
    into[t.type] ??= { $type: t.type };
    into[t.type][name] = {
      $value: alias(t.value),
      ...(t.description ? { $description: t.description } : {}),
      ...(t.alpha !== undefined ? { $extensions: { [ALPHA_EXT]: t.alpha } } : {}),
    };
  };

  /** Every axis a token branches on, and the keys of its mode branches. */
  const scan = (v: unknown, used: Set<string>, modeKeys: Set<string>): void => {
    if (!isByAxis(v)) return;
    used.add(v.by);
    for (const [k, x] of Object.entries(v)) {
      if (k === 'by') continue;
      if (v.by === 'mode') modeKeys.add(k);
      scan(x, used, modeKeys);
    }
  };

  const base: Layer = { primitives: {}, modes: {} };
  for (const mode of declaredModes) base.modes[mode] = {};
  const overrides: Record<string, Layer> = {};
  const varies: Record<string, string[]> = {};

  for (const [name, raw] of Object.entries(theme.tokens)) {
    const used = new Set<string>();
    const modeKeys = new Set<string>();
    scan(raw, used, modeKeys);
    const varying = nonMode.filter((a) => used.has(a));
    if (varying.length > 0) varies[name] = varying;
    const modes = used.has('mode') ? [...new Set([...declaredModes, ...modeKeys])] : [];

    for (const combo of enumerateSelections(Object.fromEntries(varying.map((a) => [a, axes[a]])))) {
      const key = overrideKey(axes, combo);
      const layer = key === '' ? base : (overrides[key] ??= { primitives: {}, modes: {} });
      const sel = { ...defaults, ...combo };
      if (modes.length === 0) {
        const p = pick(raw, sel);
        if (p.ok) put(layer.primitives, name, p.value);
        continue;
      }
      const picked = modes.map((mode) => [mode, pick(raw, { ...sel, mode })] as const);
      const first = picked[0][1];
      // The same leaf in every mode: this combination doesn't depend on mode.
      if (first.ok && picked.every(([, p]) => p.ok && p.value === first.value)) {
        put(layer.primitives, name, first.value);
        continue;
      }
      for (const [mode, p] of picked) if (p.ok) put((layer.modes[mode] ??= {}), name, p.value);
    }
  }

  const ext: DtcgAxesExtension = { axes, varies, overrides };
  return {
    name: theme.name,
    ...(axes.mode ? { defaultMode: axes.mode.default } : {}),
    primitives: base.primitives,
    modes: base.modes,
    ...(Object.keys(axes).length > 0 ? { $extensions: { [AXES_EXT]: ext } } : {}),
  };
}
