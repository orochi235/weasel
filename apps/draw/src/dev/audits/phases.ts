/** Where a run has an area: the phase it is in, the color that phase wears, and its lane as spans on the run's clock. */
import { getOwn } from '@weasel-js/registry';
import type { SpanState, SpanStripSpan } from '@weasel-js/ui/components/SpanStrip';
import { minutesText, stepText } from './runData';
import type { AuditArea, AuditLane, AuditRun, LaneStep, LaneStepName } from './skulkMap.types';
import palette from './palette.module.css';

/** Where every area goes, in order, `reviewed` once one of its two reviews is in: their colors run along one sweep,
 *  indigo to orange. */
export const PIPELINE = ['review', 'reviewed', 'match', 'fix', 'patch'] as const;

/** How the legend names each phase. */
export const PHASE_LABEL: Readonly<Record<AuditPhase, string>> = {
  review: 'review', reviewed: 'one review in', match: 'match', fix: 'fix', patch: 'patch', conflict: 'conflict', done: 'done',
};
/** Where an area can end up, off the sweep. */
export const OFF_PIPELINE = ['conflict', 'done'] as const;
export const AUDIT_PHASES = [...PIPELINE, ...OFF_PIPELINE] as const;
export type AuditPhase = typeof AUDIT_PHASES[number];

/** A lane's stretches, in order: the two reviewers run side by side, so they share one. */
const PARTS = ['review', 'match', 'fix', 'patch'] as const;
type Part = typeof PARTS[number];
const STEPS_OF: Readonly<Record<Part, readonly LaneStepName[]>> = { review: ['A', 'B'], match: ['match'], fix: ['fix'], patch: ['patch'] };

/** How long each stretch usually takes, in minutes: its width until it has a measured one. */
export const TYPICAL_MINUTES: Readonly<Record<Part, number>> = { review: 5, match: 0.5, fix: 18, patch: 0.5 };

/** How far past now a run's clock runs, in minutes: room for the steps still to come. */
export const CLOCK_AHEAD_MINUTES = 20;

const MIN = 60_000;

/** The phase's color, as the stylesheet defines it. */
export const phaseColor = (phase: AuditPhase): string => `var(--audit-phase-${phase})`;

/** The class that sets `--audit-phase` to the phase's color, for an element that wears it. */
export const phaseClass = (phase: AuditPhase): string => getOwn(palette, `phase-${phase}`) ?? '';

interface PartState {
  readonly part: Part;
  readonly state: LaneStep['state'];
  readonly steps: readonly LaneStep[];
}

function partState(lane: AuditLane, part: Part): PartState {
  const steps = STEPS_OF[part].map((name) => lane.steps[name]);
  const state = steps.some((s) => s.state === 'failed') ? 'failed'
    : steps.every((s) => s.state === 'done') ? 'done'
    : steps.some((s) => s.state !== 'waiting') ? 'running'
    : 'waiting';
  return { part, state, steps };
}

const partsOf = (lane: AuditLane): PartState[] => PARTS.map((part) => partState(lane, part));

/** Whether an area is through: patched, fixed with no commits to patch, or reviewed or matched with nothing to fix. */
export function isFinished(lane: AuditLane): boolean {
  const { A, B, match, fix, patch } = lane.steps;
  if (patch.state === 'done') return true;
  // Two reviews that found nothing leave nothing to match.
  if (A.state === 'done' && B.state === 'done' && (A.findings ?? 0) + (B.findings ?? 0) === 0) return true;
  // A fix that made no commits leaves no patch to apply.
  if (fix.state === 'done' && fix.commits === 0) return true;
  return match.state === 'done' && (match.a ?? 0) + (match.b ?? 0) - (match.shared ?? 0) === 0;
}

/** The phase an area is in: a conflict once any step fails, done once it is through, else the step running or next. */
export function phaseOf(lane: AuditLane): AuditPhase {
  const parts = partsOf(lane);
  if (parts.some((p) => p.state === 'failed')) return 'conflict';
  if (isFinished(lane)) return 'done';
  const part = parts.find((p) => p.state === 'running') ?? parts.find((p) => p.state === 'waiting');
  return part ? partPhase(part) : 'done';
}

/** The phase a part's color stands for: a review with one of its two reports in has gone a step further. */
function partPhase(p: PartState): AuditPhase {
  if (p.state === 'failed') return 'conflict';
  if (p.part === 'review' && p.steps.some((s) => s.state === 'done')) return 'reviewed';
  return p.part;
}

/** Whether the round's pass over an area is done: it is through, or its fixer has finished and only its patch, which
 *  lands with the round's batch, is left. */
export const passDone = (lane: AuditLane): boolean => isFinished(lane) || lane.steps.fix.state === 'done';

/** Every area a live run holds, by id, and its phase on the map: `done` once its pass is. */
export function phasesOf(runs: readonly AuditRun[]): ReadonlyMap<string, AuditPhase> {
  return new Map(runs.filter((r) => r.running).flatMap((r) => r.lanes.map((lane) => [lane.id, passDone(lane) ? 'done' : phaseOf(lane)] as const)));
}

/** `areas`, each whose pass a live run has done carrying that pass, provisional until the round's record lands. */
export function withLivePasses(areas: readonly AuditArea[], runs: readonly AuditRun[]): readonly AuditArea[] {
  const live = new Map(runs.filter((r) => r.running).flatMap((r) => r.lanes.filter((l) => l.pass && passDone(l)).map((l) => [l.id, l.pass!] as const)));
  if (live.size === 0) return areas;
  return areas.map((a) => {
    const pass = live.get(a.id);
    return pass && !a.passes.some((p) => p.round === pass.round) ? { ...a, passes: [...a.passes, { ...pass, provisional: true }] } : a;
  });
}

const ms = (iso: string | undefined): number | null => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** When a part's steps began and ended, as far as onto's records say: a running step ends now. */
function timesOf(p: PartState, now: number): { start: number | null; end: number | null } {
  const starts = p.steps.flatMap((s) => [ms(s.state === 'running' ? s.since : s.started)].filter((t): t is number => t !== null));
  const ends = p.steps.flatMap((s) => (s.state === 'running' ? [now] : [ms(s.ended)].filter((t): t is number => t !== null)));
  return {
    start: starts.length ? Math.min(...starts) : null,
    end: p.state === 'running' ? now : p.state === 'done' && ends.length === p.steps.length ? Math.max(...ends) : null,
  };
}

/** A finished part's measured minutes, where its steps report them. */
function measuredOf(p: PartState): number | null {
  const minutes = p.steps.flatMap((s) => (s.minutes === undefined ? [] : [s.minutes]));
  return minutes.length === p.steps.length ? Math.max(...minutes) : null;
}

const SPAN_STATE: Readonly<Record<LaneStep['state'], SpanState>> = { waiting: 'pending', running: 'active', done: 'done', failed: 'failed' };

/** How much of the patch to shade once the fixer reports: the share of the findings it answered that it fixed, all of
 *  it once the patch is applied, and none before the fixer reports or where it gives no tally. */
export function patchFillOf(lane: AuditLane): number {
  const { fix, patch } = lane.steps;
  if (patch.state === 'done') return 1;
  if (fix.state !== 'done' || fix.fixed === undefined) return 0;
  return fix.of ? Math.min(1, fix.fixed / fix.of) : 1;
}

/**
 * A patch span split by what its fixer left: the share it fixed, shaded as the patch is, then the share it filed
 * rather than fixed, hatched red. Whole where the fixer fixed everything, has not reported, or gave no tally.
 */
export function withUnfixed(span: SpanStripSpan, lane: AuditLane): SpanStripSpan[] {
  const { fix } = lane.steps;
  if (fix.state !== 'done' || fix.fixed === undefined || !fix.of || fix.fixed >= fix.of) return [span];
  const share = fix.fixed / fix.of;
  const left = fix.of - fix.fixed;
  return [
    { ...span, ms: span.ms * share, fill: 1 },
    {
      ...span, id: `${span.id}-unfixed`, label: '', start: undefined, ms: span.ms * (1 - share), fill: 1, state: 'failed',
      color: phaseColor('conflict'), title: `${left} of ${fix.of} filed rather than fixed`, content: undefined,
    },
  ];
}

/** The area's tally, its patch segment's caption: how many of the findings its fixer answered it fixed, and the
 *  extras it fixed besides; before the fixer reports, or where its report gives no tally, what the reviews found. */
export function tallyOf(lane: AuditLane): string {
  const { match, fix } = lane.steps;
  if (fix.state === 'done' && fix.fixed !== undefined) return `${fix.fixed} of ${fix.of ?? fix.fixed} fixed${fix.extra ? ` +${fix.extra} extra` : ''}`;
  return match.state === 'done' ? `${(match.a ?? 0) + (match.b ?? 0) - (match.shared ?? 0)} found` : '';
}

/** What a part shows in its segment: the node, what it found or made, and its minutes, never the phase's name; the
 *  patch shows the area's tally unless it failed. */
function partLabel(lane: AuditLane, p: PartState, now: number): string {
  if (p.part === 'patch' && p.state !== 'failed') return tallyOf(lane);
  if (p.state === 'waiting') return '';
  const running = p.steps.find((s) => s.state === 'running');
  if (running) return stepText(p.part === 'review' ? 'A' : p.part, running, now);
  if (p.part === 'review' && p.state === 'done') {
    const minutes = measuredOf(p);
    const found = `${p.steps.map((s) => s.findings ?? 0).join('+')} found`;
    return minutes === null ? found : `${found} · ${minutesText(minutes)}`;
  }
  return stepText(p.part === 'review' ? 'A' : p.part, p.steps[0]!, now);
}

/** An area's lane as the page draws it. */
export interface LaneView {
  readonly phase: AuditPhase;
  readonly finished: boolean;
  /** On the run's clock, in epoch ms. */
  readonly spans: SpanStripSpan[];
  /** How long the part under way has run, `12m`, or null with none under way. */
  readonly elapsed: string | null;
  /** When its last part ended, where known. */
  readonly ended: number | null;
}

/**
 * An area's lane on the run's clock: a part placed at its real start for its real minutes, a running one running to
 * `now`, one with no record of when it ran right after the part before it, and one not begun its typical minutes
 * from the later of that and now, dimmed and unfilled. The first part with no record starts at `roundStart`.
 */
export function laneViewOf(lane: AuditLane, now: number, roundStart: number): LaneView {
  let cursor = roundStart;
  let elapsed: string | null = null;
  let ended: number | null = null;
  const spans = partsOf(lane).map((p): SpanStripSpan => {
    const phase = partPhase(p);
    const times = timesOf(p, now);
    // A patch waits from its fix's end for the round's batch, shaded by what the fix did; any other part not begun yet
    // can begin no earlier than now.
    const waitsForBatch = p.part === 'patch' && p.state === 'waiting' && lane.steps.fix.state === 'done';
    const start = times.start ?? (p.state === 'waiting' && !waitsForBatch ? Math.max(cursor, now) : cursor);
    const end = times.end ?? (waitsForBatch
      ? Math.max(now, start + TYPICAL_MINUTES.patch * MIN)
      : start + (p.state === 'done' ? measuredOf(p) ?? TYPICAL_MINUTES[p.part] : TYPICAL_MINUTES[p.part]) * MIN);
    if (p.state === 'running') elapsed = minutesText((now - start) / MIN);
    if (p.state === 'done' || p.state === 'failed') ended = Math.max(ended ?? end, end);
    cursor = end;
    const title = STEPS_OF[p.part].map((name) => `${name}: ${stepText(name, lane.steps[name], now)}`).join('; ');
    return {
      id: p.part, label: partLabel(lane, p, now), start, ms: Math.max(0, end - start), color: phaseColor(phase), state: SPAN_STATE[p.state], title,
      ...(waitsForBatch ? { fill: patchFillOf(lane) } : p.state === 'waiting' ? { fill: 0 } : {}),
    };
  }).flatMap((span) => (span.id === 'patch' ? withUnfixed(span, lane) : [span]));
  return { phase: phaseOf(lane), finished: isFinished(lane), spans, elapsed, ended };
}

/** The clock a run's lanes share: from its start to `now`, and room ahead. Steady whichever lanes are shown. */
export function runClockOf(run: AuditRun, now: number): { from: number; to: number } {
  const from = ms(run.started) ?? now;
  const until = run.running ? now : ms(run.ended ?? undefined) ?? now;
  return { from, to: until + (run.running ? CLOCK_AHEAD_MINUTES * MIN : 0) };
}

/** The steps view's columns, one per step, each the color of the phase it stands for. */
/** The steps view's columns: the two blind reviews run side by side, A over B, in the first, and every later step
 *  covers both stripes. */
const STEP_COLUMNS: readonly { step: LaneStepName; part: Part; phase: AuditPhase; column: number; track?: number; trackSpan?: number }[] = [
  { step: 'A', part: 'review', phase: 'review', column: 0 },
  { step: 'B', part: 'review', phase: 'reviewed', column: 0, track: 1 },
  { step: 'match', part: 'match', phase: 'match', column: 1, trackSpan: 2 },
  { step: 'fix', part: 'fix', phase: 'fix', column: 2, trackSpan: 2 },
  { step: 'patch', part: 'patch', phase: 'patch', column: 3, trackSpan: 2 },
];

/** How many columns the steps view's window holds. */
export const STEP_COLUMN_COUNT = 1 + Math.max(...STEP_COLUMNS.map((c) => c.column));

/** How full a running step is drawn at most, until it finishes. */
const RUNNING_FILL_CAP = 0.9;

/**
 * An area's lane as the steps view draws it: a column of one length per step, filled by its state, a running one as
 * far as its minutes so far go into its typical minutes, short of full until it finishes.
 */
export function laneStepsOf(lane: AuditLane, now: number): SpanStripSpan[] {
  return STEP_COLUMNS.map(({ step, part, phase, column, track, trackSpan }): SpanStripSpan => {
    const s = lane.steps[step];
    const since = s.state === 'running' ? ms(s.since) : null;
    const fill = s.state === 'done' || s.state === 'failed' ? 1
      : step === 'patch' ? patchFillOf(lane)
      : since !== null ? Math.min(RUNNING_FILL_CAP, (now - since) / (TYPICAL_MINUTES[part] * MIN))
      : 0;
    return {
      id: step, start: column, ms: 1, track, trackSpan, fill, state: SPAN_STATE[s.state], title: `${step}: ${stepText(step, s, now)}`,
      label: step === 'patch' && s.state !== 'failed' ? tallyOf(lane) : s.state === 'waiting' ? '' : stepText(step, s, now),
      color: phaseColor(s.state === 'failed' ? 'conflict' : phase),
    };
  }).flatMap((span) => (span.id === 'patch' && span.state !== 'failed' ? withUnfixed(span, lane) : [span]));
}
