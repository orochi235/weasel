import type { LabMode } from '@weasel-js/labkit';
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
