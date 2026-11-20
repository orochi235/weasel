/** What the audit page says about areas: their tone on the map, the headline stats, and the queue. */
import { lerp } from '@weasel-js/geom';
import { warpScale } from '@weasel-js/scale';
import { getOwn } from '@weasel-js/registry';
import type { AreaStatus, AuditArea, AuditPass, AuditRun } from './skulkMap.types';

/** How an area is shaded: never read, settled, or by how many defects are estimated to be left in it. */
export type AreaTone = 'unaudited' | 'settled' | { readonly left: number };

export const STATUS_LABEL: Readonly<Record<AreaStatus, string>> = {
  unaudited: 'never audited',
  due: 'due again',
  settled: 'settled',
  tonight: 'in a live run',
};

const STAGE_LABEL: Readonly<Record<string, string>> = {
  queued: 'queued',
  reviewing: 'one review in',
  reviewed: 'both reviews in',
  matched: 'matched',
  fixed: 'fixed',
  patched: 'patched',
  conflict: 'conflict',
};

/** What a live run's stage reads as: its label, or the stage's own name when it has none. */
export const stageLabelOf = (stage: string): string => getOwn(STAGE_LABEL, stage) ?? stage;

export const lastPassOf = (area: AuditArea): AuditPass | null => area.passes.at(-1) ?? null;

export function toneOf(area: AuditArea): AreaTone {
  if (area.status === 'settled') return 'settled';
  const pass = lastPassOf(area);
  return pass ? { left: pass.left } : 'unaudited';
}

/** How near the top, as a share of the bar, a round tick gives way to the top's own. */
const TOP_ROOM = 0.12;

/** The least the heat scale's top may be, so a quiet map does not paint its few defects hot. */
const HEAT_FLOOR = 8;

/** `sorted`'s value at fraction `p` of the way through it, read between neighbors. */
function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const at = p * (sorted.length - 1);
  const lo = Math.floor(at);
  return lerp(sorted[lo]!, sorted[Math.min(lo + 1, sorted.length - 1)]!, at - lo);
}

/** Where estimated defects left sit on the heat ramp, and the values the legend marks. */
export interface HeatScale {
  /** The value that reaches the hot end: the 98th percentile of the audited areas, at least `HEAT_FLOOR`. */
  readonly top: number;
  /** `left`'s place along the ramp, 0 to 1, through log1p so the middle has room and only outliers reach the top. */
  readonly at: (left: number) => number;
  /** Round values spaced evenly along the bar, then the top. */
  readonly ticks: readonly { readonly label: string; readonly value: number }[];
}

/** The heat scale for `areas`, set by what the areas still being audited have left. */
export function heatScaleOf(areas: readonly AuditArea[]): HeatScale {
  const left = areas.flatMap((a) => (a.status === 'settled' ? [] : [lastPassOf(a)?.left ?? NaN])).filter(Number.isFinite).sort((x, y) => x - y);
  const top = Math.max(HEAT_FLOOR, quantile(left, 0.98));
  const scale = warpScale({ domain: [0, top], range: [0, 1], to: Math.log1p, from: Math.expm1 });
  const at = (v: number) => Math.min(1, Math.max(0, scale.position(Math.max(0, v))));
  // The top keeps its own tick, so a round one crowding it gives way.
  const ticks = [
    ...scale.ticks(4).filter((v) => at(v) < 1 - TOP_ROOM).map((value) => ({ label: String(value), value })),
    { label: 'top', value: top },
  ];
  return { top, at, ticks };
}

export const formatCount = (n: number): string => n.toLocaleString('en-US');

export interface Stat {
  readonly value: string;
  readonly label: string;
}

/** The headline numbers over every area. */
export function statsFor(areas: readonly AuditArea[]): Stat[] {
  const files = areas.reduce((n, a) => n + a.files, 0);
  const audited = areas.filter((a) => a.passes.length > 0);
  const auditedFiles = audited.reduce((n, a) => n + a.files, 0);
  const left = audited.reduce((n, a) => n + (lastPassOf(a)?.left ?? 0), 0);
  const found = areas.reduce((n, a) => n + a.passes.reduce((m, p) => m + p.distinct, 0), 0);
  const settled = areas.filter((a) => a.status === 'settled').length;
  return [
    { value: `${formatCount(audited.length)} / ${formatCount(areas.length)}`, label: 'areas audited at least once' },
    { value: `${files ? Math.round((100 * auditedFiles) / files) : 0}%`, label: `of ${formatCount(files)} source files charted` },
    { value: formatCount(found), label: 'defects found and fixed, all rounds' },
    { value: `≈${formatCount(Math.round(left))}`, label: 'estimated still in audited areas' },
    { value: formatCount(settled), label: 'areas settled' },
  ];
}

/** The next `count` areas a run would pick, leaving out those a live run already holds. */
/** How many rounds' worth of the queue the next-up list shows. */
export const NEXT_UP_ROUNDS = 3;

export function nextUpOf(areas: readonly AuditArea[], count = 8): AuditArea[] {
  return areas
    .filter((a) => a.queue !== null && a.status !== 'tonight')
    .sort((x, y) => (x.queue ?? 0) - (y.queue ?? 0))
    .slice(0, count);
}

/** The live run holding `id`, if one does. */
export const runHolding = (runs: readonly AuditRun[], id: string): AuditRun | undefined =>
  runs.find((r) => r.running && r.areas.includes(id));

/** What a name shows inside the frame `parent`: the rest of it past the frame's path, or its last segment where it is
 *  the frame's own name; all of it at the top. */
export function labelIn(name: string, parent: string | null): string {
  if (parent === null) return name;
  if (name.startsWith(`${parent}.`)) return name.slice(parent.length + 1);
  return name.split('.').at(-1) ?? name;
}

/** `text` cut to `max` characters, an ellipsis standing in for the rest. */
export function clip(text: string, max: number): string {
  if (max <= 0) return '';
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

/**
 * `text` in lines of at most `maxChars`, broken after its dots (`core.` / `domains.` / `paths`), at most `maxLines` of
 * them: the last holds the rest, cut short with an ellipsis where it does not fit, and so does any one piece too long
 * for a line of its own.
 */
export function wrapAtDots(text: string, maxChars: number, maxLines: number): string[] {
  if (maxChars <= 0 || maxLines <= 0) return [];
  const lines: string[] = [];
  for (const piece of text.split(/(?<=\.)/)) {
    const last = lines.at(-1);
    if (last !== undefined && (last + piece).length <= maxChars) lines[lines.length - 1] = last + piece;
    else lines.push(piece);
  }
  const kept = lines.slice(0, maxLines - 1);
  if (lines.length >= maxLines) kept.push(lines.slice(maxLines - 1).join(''));
  return kept.map((line) => clip(line, maxChars));
}
