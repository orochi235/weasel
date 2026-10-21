import { isPlainObject } from '@weasel-js/core';
import type { Globals, Layout } from '../../protocol/messages';
import { type CapturePayload, MAX_DPR, MIN_DPR } from '../../vite/capture/payload';
import type { CssOverrides } from '../cssVars/overrides';
import { effectiveGlobals, GLOBALS_KEY, PLAYHEAD_KEY, storyConfig } from '../globals';
import type { TrialInputs } from './captureContext';
import {
  comparedGlobals,
  type ForgeComparison,
  globalsSetBy,
  type LabConditions,
  resolveComparison,
  resolveContextOf,
  type ResolvedConditions,
  withArgs,
} from './conditions';
import { scrollerOf, type TrialHit } from './trialAt';

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
  /** The globals the capture renders under, the comparison's laid over the trial's own. */
  globals: Globals;
  overrides: CssOverrides;
  /** The story's host, whose box the capture takes. */
  host: HTMLElement;
  dpr: number;
  /** The comparison, whose args are laid over the config. */
  resolved: ResolvedConditions;
  lab: CapturePayload['lab'];
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

const clampDpr = (dpr: number) => Math.min(Math.max(dpr, MIN_DPR), MAX_DPR);

/**
 * The payload a capture of the trial takes, or why it cannot be sent: a capture renders the story in another
 * document, so its config and state have to survive JSON on the way, and anything that does not would render a
 * different story.
 */
export function capturePayload(input: CapturePayloadInput): CapturePayload | { unavailable: string } {
  const { entry, layout, config, state, globals, overrides, host, dpr, resolved, lab } = input;
  if (!sendable(state)) return { unavailable: STATE_UNSENDABLE };
  const sent = withArgs(storyConfig(config), resolved.args);
  if (!sendable(sent)) return { unavailable: CONFIG_UNSENDABLE };
  const box = { width: host.offsetWidth, height: host.offsetHeight };
  if (!(box.width > 0 && box.height > 0)) return { unavailable: NO_BOX };
  const isolate = entry.isolate !== undefined;
  const scroller = scrollerOf(host);
  const kept = (config as Record<string, unknown> | null | undefined)?.[PLAYHEAD_KEY];
  return {
    story: entry.id,
    isolate,
    config: sent,
    state,
    globals,
    overrides,
    playhead: !isolate && typeof kept === 'number' && Number.isFinite(kept) ? kept : null,
    box,
    layout,
    dpr: clampDpr(dpr),
    scroll: { left: scroller?.scrollLeft ?? 0, top: scroller?.scrollTop ?? 0 },
    lab,
  };
}

/**
 * The payload a Pixels lens over `hit` sends: `trial`'s story under `c`, resolved against the lab as it is now, the
 * way a Live copy of it renders — the comparison's globals for those it sets, the trial's own, pins included, for
 * the rest.
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
  const resolved = resolveComparison(c, lab.labValues, ctx);
  const own = effectiveGlobals(lab.labValues, (trial.config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY]);
  const mode = lab.mode === 'auto' ? (ctx.prefersDark ? 'dark' : 'light') : lab.mode;
  return capturePayload({
    ...trial,
    globals: comparedGlobals(own, c === null ? null : resolved.globals, globalsSetBy(c, ctx)),
    host: hit.host,
    dpr,
    resolved,
    lab: { globals: lab.labValues, mode },
  });
}
