/** What the audit page says about areas: their tone on the map, the headline stats, and the queue. */
import type { AreaStatus, AuditArea, AuditPass, AuditRun } from './skulkMap.types';

/** How an area is shaded: never read, settled, or by how many defects are estimated to be left in it. */
export type AreaTone = 'unaudited' | 'settled' | 0 | 1 | 2 | 3 | 4;

export const STATUS_LABEL: Readonly<Record<AreaStatus, string>> = {
  unaudited: 'never audited',
  due: 'due again',
  settled: 'settled',
  tonight: 'in a live run',
};

export const STAGE_LABEL: Readonly<Record<string, string>> = {
  queued: 'queued',
  reviewing: 'one review in',
  reviewed: 'both reviews in',
  matched: 'matched',
  fixed: 'fixed',
  patched: 'patched',
  conflict: 'conflict',
};

/** The ramp's upper bounds on estimated defects left: under 0.75 is the lightest step, 6 or more the darkest. */
const DEPTH_STEPS = [0.75, 2, 3.5, 6] as const;

export const lastPassOf = (area: AuditArea): AuditPass | null => area.passes.at(-1) ?? null;

export function depthFor(left: number): 0 | 1 | 2 | 3 | 4 {
  const i = DEPTH_STEPS.findIndex((bound) => left < bound);
  return (i === -1 ? 4 : i) as 0 | 1 | 2 | 3 | 4;
}

export function toneOf(area: AuditArea): AreaTone {
  if (area.status === 'settled') return 'settled';
  const pass = lastPassOf(area);
  return pass ? depthFor(pass.left) : 'unaudited';
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
export function nextUpOf(areas: readonly AuditArea[], count = 8): AuditArea[] {
  return areas
    .filter((a) => a.queue !== null && a.status !== 'tonight')
    .sort((x, y) => (x.queue ?? 0) - (y.queue ?? 0))
    .slice(0, count);
}

/** The live run holding `id`, if one does. */
export const runHolding = (runs: readonly AuditRun[], id: string): AuditRun | undefined =>
  runs.find((r) => r.running && r.areas.includes(id));

/** The label inside an area's cell: its id without the package it sits in. */
export function cellLabelOf(id: string): string {
  const parts = id.split('.');
  return parts.length > 1 ? parts.slice(1).join('.') : id;
}

/** `text` cut to `max` characters, an ellipsis standing in for the rest. */
export function clip(text: string, max: number): string {
  if (max <= 0) return '';
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}
