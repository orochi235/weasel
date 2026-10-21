import type { LabMode } from '@weasel-js/labkit';
import { withValueAtPath } from '@weasel-js/labkit/config';
import type { Globals } from '../../protocol/messages';
import type { GlobalDeclarations } from '../globals';

/** What a lens compares the story against: the lab's opposite color mode, or globals, args and a DPR of its own. */
export type ForgeComparison =
  | { kind: 'opposite-mode' }
  | {
      kind: 'custom';
      globals?: Readonly<Record<string, string>>;
      args?: Readonly<Record<string, unknown>>;
      dpr?: number;
    };

/** The conditions a compared render runs under. `dpr` is null where the comparison leaves it alone. */
export interface ResolvedConditions {
  globals: Globals;
  args: Readonly<Record<string, unknown>>;
  dpr: number | null;
}

/** What resolving a comparison reads besides the comparison and the globals it starts from. */
export interface ResolveContext {
  declarations: GlobalDeclarations;
  modeGlobal: string;
  prefersDark: boolean;
  labMode: LabMode;
}

const NO_ARGS: Readonly<Record<string, unknown>> = {};

/**
 * The conditions `c` asks for, starting from `base`. Resolved when a lens renders rather than when the comparison is
 * chosen, so it follows the lab. Only `custom` is resolved so far; `opposite-mode` leaves the story as it is.
 */
export function resolveComparison(
  c: ForgeComparison | null,
  base: Globals,
  _ctx: ResolveContext,
): ResolvedConditions {
  if (c === null || c.kind !== 'custom') return { globals: base, args: NO_ARGS, dpr: null };
  return {
    globals: c.globals ? { ...base, ...c.globals } : base,
    args: c.args ?? NO_ARGS,
    dpr: c.dpr ?? null,
  };
}

const NO_KEYS: readonly string[] = [];

/** The globals `c` sets, which a copy takes from its resolution; every other global stays the trial's own. */
export function globalsSetBy(c: ForgeComparison | null, ctx: ResolveContext): readonly string[] {
  if (c === null) return NO_KEYS;
  return c.kind === 'opposite-mode' ? [ctx.modeGlobal] : Object.keys(c.globals ?? {});
}

/** `config` with each of `args` written at its path. */
export const withArgs = (config: unknown, args: Readonly<Record<string, unknown>>): unknown =>
  Object.entries(args).reduce((c, [path, value]) => withValueAtPath(c, path, value), config);

/** The globals a compared render runs under: `resolved`'s for each global the comparison sets, `own` for the rest. */
export function comparedGlobals(own: Globals, resolved: Globals | null, sets: readonly string[]): Globals {
  return resolved ? { ...own, ...Object.fromEntries(sets.map((key) => [key, resolved[key]])) } : own;
}

/** The lab as a lens reads it when it renders: its globals, its mode, and the declarations behind them. */
export interface LabConditions {
  labValues: Globals;
  mode: LabMode;
  declarations: GlobalDeclarations;
  modeGlobal: string;
}

/** What resolving a comparison against `lab` reads, the OS color scheme included. */
export function resolveContextOf(lab: LabConditions): ResolveContext {
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return { declarations: lab.declarations, modeGlobal: lab.modeGlobal, prefersDark, labMode: lab.mode };
}
