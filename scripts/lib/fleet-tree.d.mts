/** What a fleet run's tree must hold: each path the commit changes against its base, by git blob id, or null where the commit deletes it. */
export interface TreeMarker {
  commit: string;
  /** The branch the run tests; typecheck keeps a build info per branch. */
  branch?: string;
  files: Record<string, string | null>;
  /** On a branch run, the paths the branch changes: the suite is limited to what they reach. */
  select?: string[];
  /** The paths in `select` the branch adds or deletes. */
  reshaped?: string[];
}
export interface BranchChanges {
  changed: string[];
  reshaped: string[];
}
export interface TreeCheck {
  armed: boolean;
  commit: string | undefined;
  checked: number;
  problems: string[];
}
export const MARKER: string;
export const COMMIT_ENV: string;
export const ONTO_STAMP: string;
export function treeStamp(root: string): string;
export function stampReport(before: string, after: string): { ok: boolean; text: string };
export function blobHash(bytes: Uint8Array): string;
export function changedFiles(rawDiff: string): Record<string, string | null>;
export function stepEnv(env: Record<string, string | undefined>): Record<string, string | undefined>;
export function armTree(tree: string, marker: TreeMarker, opts?: { plan?: boolean }): string;
export function checkTree(root: string, env: Record<string, string | undefined>): TreeCheck;
export function treeReport(check: TreeCheck): { ok: boolean; text: string };
export function fleetBranch(root: string, env: Record<string, string | undefined>): string | undefined;
export function branchChanges(
  root: string,
  env: Record<string, string | undefined>,
  opts: { triggers: string[] },
): BranchChanges | undefined;
export function selection(
  root: string,
  env: Record<string, string | undefined>,
  opts: { always: string[]; triggers: string[] },
): string[] | undefined;
