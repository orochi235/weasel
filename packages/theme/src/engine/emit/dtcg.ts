import { isByAxis, type Varying } from '../../axes';
import { ALPHA_EXT, type RawToken, type TokenValue } from '../../dtcg/types';
import { themeAxes } from '../../resolveTheme';
import type { Theme } from '../../theme';

type Group = Record<string, unknown> & { $type: string };

const REF = /^\{([^}.]+)\}$/;

export interface DtcgExport {
  readonly name: string;
  readonly defaultMode?: string;
  readonly primitives: Record<string, Group>;
  readonly modes: Record<string, Record<string, Group>>;
}

/**
 * A theme's own tokens as a DTCG document `loadDTCG` reads back. `extends` is
 * not carried; pass it to `loadDTCG`. Every mode the chain declares is written,
 * so a token that leaves one out still falls through to the parent on the way back.
 *
 * DTCG has one variant dimension and no standard way to name a second, so mode
 * is the only axis exported: a token varying by any other axis is written at
 * that axis's default value and its other branches are dropped. Round-tripping
 * a theme through DTCG therefore flattens it to the default selection of every
 * non-mode axis.
 */
export function toDTCG(theme: Theme): DtcgExport {
  const axes = themeAxes(theme);

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

  /** Every non-mode axis collapsed to its default branch, so only mode is left varying. */
  const flatten = (v: Varying<RawToken>): Varying<RawToken> | undefined => {
    if (!isByAxis(v)) return v;
    if (v.by === 'mode') {
      const out: Record<string, unknown> = { by: 'mode' };
      for (const [mode, x] of Object.entries(v)) {
        if (mode === 'by') continue;
        const inner = flatten(x as Varying<RawToken>);
        if (inner !== undefined) out[mode] = inner;
      }
      return out as Varying<RawToken>;
    }
    const fallback = axes[v.by]?.default;
    const chosen = fallback !== undefined ? v[fallback] : undefined;
    return chosen === undefined ? undefined : flatten(chosen as Varying<RawToken>);
  };

  const branches = (v: Varying<RawToken>): [string, RawToken][] => {
    if (!isByAxis(v)) return [];
    return Object.entries(v).flatMap(([mode, x]) => (mode === 'by' ? [] : [[mode, x as RawToken] as [string, RawToken]]));
  };

  const modes: Record<string, Record<string, Group>> = {};
  for (const mode of Object.keys(axes.mode?.values ?? {})) modes[mode] = {};
  const primitives: Record<string, Group> = {};
  for (const [name, raw] of Object.entries(theme.tokens)) {
    const v = flatten(raw);
    if (v === undefined) continue;
    if (!isByAxis(v)) put(primitives, name, v);
    else for (const [mode, t] of branches(v)) put((modes[mode] ??= {}), name, t);
  }

  return { name: theme.name, ...(axes.mode ? { defaultMode: axes.mode.default } : {}), primitives, modes };
}
