import type { LabMode } from '@weasel-js/labkit';
import { withValueAtPath } from '@weasel-js/labkit/config';
import type { Globals } from '../../protocol/messages';
import { effectiveGlobals, FOLLOW_APP, GLOBALS_KEY, type GlobalDeclarations } from '../globals';

/** What a lens compares the story against: the opposite color mode, or globals, args and a DPR of its own. */
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

/** `value` with `App` read from the lab's own mode and `auto` from the OS, as the story would be shown. */
function shownMode(value: string, ctx: ResolveContext): string {
  const followed = value === FOLLOW_APP ? ctx.labMode : value;
  return followed === 'auto' ? (ctx.prefersDark ? 'dark' : 'light') : followed;
}

const SWAP: Readonly<Record<string, string>> = { light: 'dark', dark: 'light' };

/**
 * The mode opposite the one `base` shows, from its declaration's `opposite` or else a swap of light and dark; `to`
 * is undefined where it has none.
 */
export function oppositeMode(base: Globals, ctx: ResolveContext): { from: string; to: string | undefined } {
  const from = shownMode(String(base[ctx.modeGlobal] ?? ''), ctx);
  const own = ctx.declarations[ctx.modeGlobal]?.opposite;
  return { from, to: own ? own(from, base) : SWAP[from] };
}

/**
 * The conditions `c` asks for, starting from `base` — the globals the story renders under before the comparison,
 * pins included. Resolved when a lens renders rather than when the comparison is chosen, so opposite mode keeps
 * showing the opposite after the lab's mode changes; a mode with no opposite leaves the story as it is.
 */
export function resolveComparison(c: ForgeComparison | null, base: Globals, ctx: ResolveContext): ResolvedConditions {
  if (c === null) return { globals: base, args: NO_ARGS, dpr: null };
  if (c.kind === 'opposite-mode') {
    const { to } = oppositeMode(base, ctx);
    return { globals: to === undefined ? base : { ...base, [ctx.modeGlobal]: to }, args: NO_ARGS, dpr: null };
  }
  return {
    globals: c.globals ? { ...base, ...c.globals } : base,
    args: c.args ?? NO_ARGS,
    dpr: c.dpr ?? null,
  };
}

/** A global's value as the toolbar names it: "Theme: Ocean". */
function globalLabel(key: string, value: string, declarations: GlobalDeclarations): string {
  const declaration = declarations[key];
  if (!declaration) return `${key}: ${value}`;
  const option = declaration.options.find((o) => o.value === value);
  return `${declaration.label}: ${option?.label ?? value}`;
}

/** What a lens's comparison is named against: the globals it resolves over, and whether the lens shows Pixels. */
export interface DescribeAgainst {
  base: Globals;
  ctx: ResolveContext;
  /** False on a lens that shows no Pixels, where a DPR comparison changes nothing. */
  pixels?: boolean;
}

/**
 * How a lens names `c`: "Opposite mode", "Theme: Ocean", "Arg size = 3", "DPR 2×". Given what the lens renders
 * against, opposite mode says so when there is no opposite to show, and a DPR says it applies to Pixels only on a
 * lens that shows none.
 */
export function describeComparison(c: ForgeComparison, declarations: GlobalDeclarations, against?: DescribeAgainst): string {
  if (c.kind === 'opposite-mode') {
    const flip = against ? oppositeMode(against.base, against.ctx) : null;
    return flip && flip.to === undefined ? `Opposite mode: no opposite for '${flip.from}'` : 'Opposite mode';
  }
  const globals = Object.entries(c.globals ?? {}).map(([key, value]) => globalLabel(key, value, declarations));
  const args = Object.entries(c.args ?? {}).map(([path, value]) => `Arg ${path} = ${String(value)}`);
  const dpr = c.dpr ? [`DPR ${c.dpr}×${against?.pixels === false ? ' (Pixels only)' : ''}`] : [];
  return [...globals, ...args, ...dpr].join(', ') || 'As it is';
}

/**
 * How a lens over a trial names `c`: against that trial's own globals, pins included, as the lens renders it, and
 * whether the lens shows Pixels.
 */
export function describeLens(c: ForgeComparison, lab: LabConditions, trialConfig: unknown, pixels: boolean): string {
  const pins = (trialConfig as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const base = effectiveGlobals(lab.labValues, pins);
  return describeComparison(c, lab.declarations, { base, ctx: resolveContextOf(lab), pixels });
}

/** `config` with each of `args` written at its path. */
export const withArgs = (config: unknown, args: Readonly<Record<string, unknown>>): unknown =>
  Object.entries(args).reduce((c, [path, value]) => withValueAtPath(c, path, value), config);

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
