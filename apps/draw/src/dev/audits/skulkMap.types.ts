/** The JSON `scripts/skulk/map.mjs` prints, which `/__skulk/map` serves. */

/** `tonight` is an area a live run holds. */
export type AreaStatus = 'unaudited' | 'due' | 'settled' | 'tonight';

export interface AuditPass {
  readonly round: number;
  readonly date: string;
  readonly a: number;
  readonly b: number;
  readonly shared: number;
  readonly distinct: number;
  readonly est: number;
  readonly left: number;
}

export interface AuditArea {
  readonly id: string;
  readonly group: string;
  readonly files: number;
  readonly status: AreaStatus;
  readonly queue: number | null;
  readonly passes: readonly AuditPass[];
  readonly stage: string | null;
}

export type LaneStepName = 'A' | 'B' | 'match' | 'fix' | 'patch';

export interface LaneStep {
  readonly state: 'waiting' | 'running' | 'done' | 'failed';
  readonly node?: string;
  readonly since?: string;
  readonly findings?: number;
  readonly read?: number;
  readonly files?: number;
  readonly minutes?: number;
  readonly shared?: number;
  readonly a?: number;
  readonly b?: number;
  readonly commits?: number;
  readonly why?: string;
}

export interface AuditLane {
  readonly id: string;
  readonly steps: Readonly<Record<LaneStepName, LaneStep>>;
}

export interface AuditRun {
  readonly running: boolean;
  readonly round: number;
  readonly started?: string;
  readonly ended: string | null;
  readonly step: string;
  readonly costUsd: number;
  readonly capUsd: number | null;
  readonly report: string | null;
  readonly areas: readonly string[];
  readonly stages: Readonly<Record<string, string>>;
  readonly lanes: readonly AuditLane[];
  readonly sweepRunning: boolean;
  readonly lastLine: string | null;
  readonly lines: readonly string[];
}

export interface AuditRound {
  readonly round: number;
  readonly date: string;
  readonly areas: number;
  readonly files: number;
  readonly distinct: number;
  readonly est: number;
}

export interface SkulkMap {
  readonly generated: string;
  readonly head: string;
  readonly runs: readonly AuditRun[];
  readonly areas: readonly AuditArea[];
  readonly rounds: readonly AuditRound[];
}
