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

const modeOnly = (theme: string, what: string) => new Error(`DTCG export supports a mode axis only; ${theme} ${what}`);

/**
 * A theme's own tokens as a DTCG document `loadDTCG` reads back. `extends` is
 * not carried; pass it to `loadDTCG`. Every mode the chain declares is written,
 * so a token that leaves one out still falls through to the parent on the way back.
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

  const branches = (name: string, v: Varying<RawToken>): [string, RawToken][] => {
    if (!isByAxis(v)) return [];
    if (v.by !== 'mode') throw modeOnly(`"${name}"`, `varies by ${v.by}`);
    return Object.entries(v).flatMap(([mode, x]) => {
      if (mode === 'by') return [];
      if (isByAxis(x)) throw modeOnly(`"${name}"`, `varies by ${x.by} inside mode`);
      return [[mode, x as RawToken]];
    });
  };

  const modes: Record<string, Record<string, Group>> = {};
  for (const mode of Object.keys(axes.mode?.values ?? {})) modes[mode] = {};
  const primitives: Record<string, Group> = {};
  for (const [name, v] of Object.entries(theme.tokens)) {
    if (!isByAxis(v)) put(primitives, name, v);
    else for (const [mode, t] of branches(name, v)) put((modes[mode] ??= {}), name, t);
  }

  return { name: theme.name, ...(axes.mode ? { defaultMode: axes.mode.default } : {}), primitives, modes };
}
