import { isPlainObject } from '@weasel-js/core';
import type { Globals, Layout } from '../../protocol/messages';
import { type CapturePayload, MAX_DPR, MIN_DPR } from '../../vite/capture/payload';
import type { CssOverrides } from '../cssVars/overrides';
import { effectiveGlobals, GLOBALS_KEY, storyConfig } from '../globals';
import type { TrialInputs } from './captureContext';
import {
  type ForgeComparison,
  type LabConditions,
  resolveComparison,
  resolveContextOf,
  type ResolvedConditions,
  withArgs,
} from './conditions';
import { scrollOf } from './frameScroll';
import type { TrialHit } from './trialAt';

export const STATE_UNSENDABLE = "this story's state cannot be sent to a capture";
export const CONFIG_UNSENDABLE = "this story's config cannot be sent to a capture";
export const NO_STORY = 'this trial shows no story to capture';
export const NO_BOX = "the story's box has no size";

/** What a capture of one trial is built from. */
export interface CapturePayloadInput {
  entry: TrialInputs['entry'];
  layout: Layout;
  /** The trial's whole config, forge's `$` keys included. */
  config: unknown;
  state: unknown;
  /** The globals the capture renders under: the comparison resolved over the trial's own. */
  globals: Globals;
  overrides: CssOverrides;
  /** The story's host, whose box the capture takes. */
  host: HTMLElement;
  dpr: number;
  /** The comparison, whose args are laid over the config and whose DPR, if any, replaces `dpr`. */
  resolved: ResolvedConditions;
  lab: CapturePayload['lab'];
  colorScheme: CapturePayload['colorScheme'];
  /** Where the story's playhead stands while paused; null while it plays, or with no timeline. */
  playhead: number | null;
}

/** Whether `round`, `value` sent through JSON, is `value` again: nothing dropped, nothing turned into something else. */
function survived(value: unknown, round: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value === round;
  if (typeof value === 'number') return Number.isFinite(value) && value === round;
  if (Array.isArray(value)) {
    if (!Array.isArray(round) || value.length !== round.length) return false;
    // `every` skips a hole, which JSON writes as null.
    for (let i = 0; i < value.length; i += 1) if (!(i in value) || !survived(value[i], round[i])) return false;
    return true;
  }
  if (!isPlainObject(value) || !isPlainObject(round)) return false;
  const keys = Object.keys(value);
  return keys.length === Object.keys(round).length && keys.every((key) => key in round && survived(value[key], round[key]));
}

function sendable(state: unknown): boolean {
  try {
    return survived(state, JSON.parse(JSON.stringify(state) ?? 'undefined'));
  } catch {
    return false;
  }
}

/** `value` without its plain objects' undefined entries, which JSON drops and a story reads as unset either way. */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, v]) => (v === undefined ? [] : [[key, withoutUndefined(v)]])),
  );
}

const clampDpr =(dpr: number) => Math.min(Math.max(dpr, MIN_DPR), MAX_DPR);

/**
 * The payload a capture of the trial takes, or why it cannot be sent: a capture renders the story in another
 * document, so its config and state have to survive JSON on the way, and anything that does not would render a
 * different story.
 */
export function capturePayload(input: CapturePayloadInput): CapturePayload | { unavailable: string } {
  const { entry, layout, config, state, globals, overrides, host, dpr, resolved, lab, colorScheme, playhead } = input;
  if (!sendable(state)) return { unavailable: STATE_UNSENDABLE };
  const sent = withoutUndefined(withArgs(storyConfig(config), resolved.args));
  if (!sendable(sent)) return { unavailable: CONFIG_UNSENDABLE };
  const box = { width: host.offsetWidth, height: host.offsetHeight };
  if (!(box.width > 0 && box.height > 0)) return { unavailable: NO_BOX };
  const isolate = entry.isolate !== undefined;
  return {
    story: entry.id,
    isolate,
    config: sent,
    state,
    globals,
    overrides,
    playhead: isolate ? null : playhead,
    box,
    layout,
    dpr: clampDpr(resolved.dpr ?? dpr),
    scroll: scrollOf(host),
    lab,
    colorScheme,
  };
}

/**
 * The payload a Pixels lens over `hit` sends: `trial`'s story under `c`, resolved against the lab as it is now and
 * over the trial's own globals, pins included, the way a Live copy of it renders.
 */
export function trialPayload(
  trial: TrialInputs | null,
  lab: LabConditions,
  hit: TrialHit,
  dpr: number,
  c: ForgeComparison | null,
): CapturePayload | { unavailable: string } {
  if (!trial) return { unavailable: NO_STORY };
  const ctx = resolveContextOf(lab);
  const own = effectiveGlobals(lab.labValues, (trial.config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY]);
  const resolved = resolveComparison(c, own, ctx);
  const colorScheme = ctx.prefersDark ? 'dark' : 'light';
  const { playhead, ...inputs } = trial;
  return capturePayload({
    ...inputs,
    playhead: playhead(),
    globals: resolved.globals,
    host: hit.host,
    dpr,
    resolved,
    lab: { globals: lab.labValues, mode: lab.mode === 'auto' ? colorScheme : lab.mode },
    colorScheme,
  });
}
