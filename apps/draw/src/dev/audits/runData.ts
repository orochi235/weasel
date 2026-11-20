/** What the audit page says about runs: each one's headline, its lanes, and the jobs its log reports. */
import type { AuditRun, LaneStep, LaneStepName } from './skulkMap.types';

/** Minutes since `iso` as `<1m` or `12m`. */
export function minutesSince(iso: string, now: number): string {
  const m = Math.max(0, (now - new Date(iso).getTime()) / 60_000);
  return m < 1 ? '<1m' : `${Math.round(m)}m`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What one step of an area's lane shows. */
export function stepText(step: LaneStepName, s: LaneStep, now: number): string {
  if (s.state === 'running') return `${s.node ?? ''} · ${s.since ? minutesSince(s.since, now) : 'running'}`;
  if (s.state === 'failed') return s.why ?? 'failed';
  if (s.state !== 'done') return step === 'patch' ? 'after fix' : 'waiting';
  if (step === 'A' || step === 'B') return `${s.findings ?? 0} found · ${(s.minutes ?? 0).toFixed(1)}m`;
  if (step === 'match') return `${s.shared ?? 0} shared of ${s.a ?? 0}+${s.b ?? 0}`;
  if (step === 'fix') return `${plural(s.commits ?? 0, 'commit')} · ${(s.minutes ?? 0).toFixed(0)}m`;
  return `${s.commits ?? 0} applied`;
}

/** The run's line under every area's lane: the batch, the fleet run and the merge, which every area shares. */
export function sharedLaneOf(run: AuditRun): { state: LaneStep['state']; text: string } {
  if (!run.running) return { state: 'done', text: run.report ?? 'done' };
  if (run.step === 'batch' || run.step === 'merge' || run.step === 'fleet') {
    return { state: 'running', text: `${run.step}: merging every area's fixes, then one fleet run` };
  }
  return { state: 'waiting', text: 'batch, fleet run and merge, once every lane is patched' };
}

export function headlineOf(run: AuditRun): string {
  if (run.running) return `Round ${run.round} running · ${run.step} · ${plural(run.areas.length, 'area')}`;
  const summary = run.report?.split(';')[0];
  return summary ? `Round ${run.round} finished · ${summary}` : `Round ${run.round} finished`;
}

export function spendOf(run: AuditRun): string {
  const cost = `$${run.costUsd.toFixed(2)}`;
  return run.capUsd ? `${cost} of $${run.capUsd}` : cost;
}

export function lastLineOf(run: AuditRun): string {
  return run.lastLine ?? (run.running ? 'Started; no job has finished yet.' : '');
}

export type JobKind = 'review' | 'match' | 'fix' | 'patch' | 'batch' | 'sweep' | 'fleet' | 'night';

/** One job a run's log reports finished. */
export interface Job {
  readonly kind: JobKind;
  readonly label: string;
  readonly area: string;
  readonly what: string;
  readonly node?: string;
  readonly minutes?: number;
  readonly tokens?: number;
  /** Its place among the round's jobs of its kind, `3/16`. */
  readonly of?: string;
  /** Whether it went wrong: a review that skipped files, a conflict, a failed fleet run. */
  readonly bad: boolean;
}

/** The job a `night.log` line reports, or null for a line that reports none. */
export function parseJob(line: string): Job | null {
  let m: RegExpExecArray | null;
  if ((m = /^review (\d+)\/(\d+) (\S+) ([AB]) on (\S+): (\d+) findings, (\d+)\/(\d+) files read, ([\d.]+) min, ([\d.]+)M tokens/.exec(line))) {
    return {
      kind: 'review', label: `review ${m[4]}`, area: m[3]!, what: `${plural(Number(m[6]), 'finding')}, read ${m[7]} of ${m[8]} files`,
      node: m[5], minutes: Number(m[9]), tokens: Number(m[10]), of: `${m[1]}/${m[2]}`, bad: m[7] !== m[8],
    };
  }
  if ((m = /^match (\d+)\/(\d+) (\S+): (\d+) shared of (\d+) \+ (\d+)/.exec(line))) {
    return { kind: 'match', label: 'match', area: m[3]!, what: `${m[4]} found by both, of ${m[5]} + ${m[6]}`, of: `${m[1]}/${m[2]}`, bad: false };
  }
  if ((m = /^fix (\d+)\/(\d+) (\S+) on (\S+): (\d+) commits, ([\d.]+) min, ([\d.]+)M tokens/.exec(line))) {
    return {
      kind: 'fix', label: 'fix', area: m[3]!, what: plural(Number(m[5]), 'commit'),
      node: m[4], minutes: Number(m[6]), tokens: Number(m[7]), of: `${m[1]}/${m[2]}`, bad: false,
    };
  }
  if ((m = /^patch (\S+): (\d+) commits on (\S+)/.exec(line))) {
    return { kind: 'patch', label: 'patch', area: m[1]!, what: `${m[2]} commits on ${m[3]}`, bad: false };
  }
  if ((m = /^batch: audit\d+-(\S+) conflicts/.exec(line))) {
    return { kind: 'batch', label: 'batch', area: m[1]!, what: 'conflicts; left out of the batch', bad: true };
  }
  if (line.startsWith('control sweep:')) {
    return { kind: 'sweep', label: 'sweep', area: '', what: line.replace(/^control sweep: /, '').replace(/; see \S+/, ''), bad: line.includes('did not run') };
  }
  if (line.startsWith('fleet:')) return { kind: 'fleet', label: 'fleet', area: '', what: line.replace(/^fleet: /, ''), bad: line.includes('fail') };
  if ((m = /^(night|record|batch): (.*)$/.exec(line))) return { kind: 'night', label: m[1]!, area: '', what: m[2]!, bad: false };
  return null;
}

/** A job and the round whose log it came from, keyed by the line that reported it. */
export interface RunJob {
  readonly key: string;
  readonly line: string;
  readonly round: number;
  readonly job: Job;
}

/** Each run's jobs, newest first, live runs before the finished one, at most `perRun` from each. */
export function recentJobsOf(runs: readonly AuditRun[], perRun = 14): RunJob[] {
  return runs.flatMap((run) => run.lines
    .map((line) => ({ key: `${run.round}:${line}`, line, round: run.round, job: parseJob(line) }))
    .filter((r): r is RunJob => r.job !== null)
    .reverse()
    .slice(0, perRun));
}
