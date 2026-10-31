/** How a commit is drawn: a plain dot, a crossed one for a revert, a square to stand out. */
export type GitCommitType = 'NORMAL' | 'REVERSE' | 'HIGHLIGHT';

/** One line of a git graph, in the order it runs. */
export type GitCommand =
  | { kind: 'commit'; id?: string; type?: GitCommitType; tag?: string; message?: string }
  | { kind: 'branch'; name: string; order?: number }
  | { kind: 'checkout'; name: string }
  | { kind: 'merge'; branch: string; id?: string; type?: GitCommitType; tag?: string }
  | { kind: 'cherry-pick'; id: string; tag?: string; parent?: string };

/** A git graph: the commands that build its history, replayed to lay out a lane per branch. */
export interface GitGraphData {
  kind: 'gitgraph';
  title?: string;
  /** Default `'LR'`: commits run left to right, branches stack downward. */
  orientation?: 'LR' | 'TB' | 'BT';
  /** Default `'main'`. */
  mainBranch?: string;
  commands: readonly GitCommand[];
}
