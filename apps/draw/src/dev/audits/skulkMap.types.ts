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
  /** A live run's pass, its area's pass done and its round's record not yet landed. */
  readonly provisional?: boolean;
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
  /** A done fix's tally, where its report gives one: of the `of` findings it was given, how many it fixed, and the
   *  defects nobody had listed it fixed besides. */
  readonly fixed?: number;
  readonly of?: number;
  readonly extra?: number;
  readonly why?: string;
  /** When a done step began and ended, from onto's record of the job that ran it. */
  readonly started?: string;
  readonly ended?: string;
}

export interface AuditLane {
  readonly id: string;
  readonly steps: Readonly<Record<LaneStepName, LaneStep>>;
  /** The pass this round has made of the area, once matched, as its record will hold it. */
  readonly pass?: AuditPass;
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
  readonly nightDir?: string | null;
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
  /** A round with no committed record, read from its run's night directory: still running, or not merged. */
  readonly pending?: 'live' | 'unmerged';
}

export interface SkulkMap {
  readonly generated: string;
  readonly head: string;
  readonly runs: readonly AuditRun[];
  readonly areas: readonly AuditArea[];
  readonly rounds: readonly AuditRound[];
}

/** One defect as a round tells it: what was broken, who listed it, what became of it, and what the fix changed. */
export interface AuditDefect {
  readonly claim: string;
  /** `A`, `B`, `A+B`, `sweep`, or `extra` for one the fixer found itself. */
  readonly from: string;
  readonly verdict: 'fixed' | 'not a defect' | 'duplicate' | 'question' | 'not fixed' | 'open';
  readonly note: string;
}

/** One round's defects in an area: from its record once landed, and from its fixer's report once it has one. */
export interface AuditAreaRound {
  readonly round: number;
  readonly recorded: boolean;
  readonly fixed: boolean;
  readonly items: readonly AuditDefect[];
}
