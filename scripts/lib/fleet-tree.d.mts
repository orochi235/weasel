/** What a fleet run's tree must hold: each path the commit changes against its base, by git blob id, or null where the commit deletes it. */
export interface TreeMarker {
  commit: string;
  files: Record<string, string | null>;
  /** Limit the suite to what `files` reaches, rather than run all of it. */
  select?: boolean;
}
export interface TreeCheck {
  armed: boolean;
  commit: string | undefined;
  checked: number;
  problems: string[];
}
export const MARKER: string;
export const COMMIT_ENV: string;
export function blobHash(bytes: Uint8Array): string;
export function changedFiles(rawDiff: string): Record<string, string | null>;
export function armTree(tree: string, marker: TreeMarker): void;
export function checkTree(root: string, env: Record<string, string | undefined>): TreeCheck;
export function treeReport(check: TreeCheck): { ok: boolean; text: string };
export function selection(
  root: string,
  env: Record<string, string | undefined>,
  opts: { always: string[]; triggers: string[] },
): string[] | undefined;
