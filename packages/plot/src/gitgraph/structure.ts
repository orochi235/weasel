/** Edits to a gitgraph's commands as a collection, each command's fields, and the graph's options, as plain data in and
 *  out. */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import { replayGitGraph } from './replay';
import type { GitCommand, GitCommitType, GitGraphData } from './types';

/** The kinds of command a graph runs. */
export const GIT_COMMAND_KINDS = ['commit', 'branch', 'checkout', 'merge', 'cherry-pick'] as const;

/** A command's fields besides its kind. */
export type GitCommandField = 'id' | 'type' | 'tag' | 'message' | 'name' | 'branch' | 'order' | 'parent';

/** The fields each kind of command holds; `id` on a cherry-pick names the commit it picks. */
export const GIT_COMMAND_FIELDS: { readonly [K in GitCommand['kind']]: readonly GitCommandField[] } = {
  commit: ['id', 'type', 'tag', 'message'],
  branch: ['name', 'order'],
  checkout: ['name'],
  merge: ['branch', 'id', 'type', 'tag'],
  'cherry-pick': ['id', 'tag', 'parent'],
};

const mainOf = (data: GitGraphData): string => data.mainBranch ?? 'main';

/** The branches the graph names, its main branch first. */
export const gitBranchNames = (data: GitGraphData): string[] =>
  [mainOf(data), ...data.commands.flatMap((c) => (c.kind === 'branch' && c.name !== mainOf(data) ? [c.name] : []))];

/** `data` with `command` inserted before command `at`; absent, a plain commit. */
export const insertGitCommand = (data: GitGraphData, at: number, command: GitCommand = { kind: 'commit' }): GitGraphData =>
  ({ ...data, commands: insertAt(data.commands, at, command, 'insertGitCommand') });

/** `data` without command `command`. Throws on a command it does not hold. */
export const removeGitCommand = (data: GitGraphData, command: number): GitGraphData =>
  ({ ...data, commands: removeAt(data.commands, command, 'removeGitCommand') });

/** `data` with command `from` moved to index `to`, counted once it is taken out. */
export const moveGitCommand = (data: GitGraphData, from: number, to: number): GitGraphData =>
  (from === to ? data : { ...data, commands: moveAt(data.commands, from, to, 'moveGitCommand') });

/** `data` with command `at` replaced by `command`. Throws on a command it does not hold. */
export const setGitCommand = (data: GitGraphData, at: number, command: GitCommand): GitGraphData =>
  (data.commands[at] === command ? data : { ...data, commands: updateAt(data.commands, at, () => command, 'setGitCommand') });

/**
 * `data` with command `at` turned into a command of `kind`, keeping the fields both kinds hold. What the new kind needs
 * and the old did not hold is filled in, from the history before it: a fresh name for a branch, the main branch to check
 * out, the latest other branch to merge, the latest commit on another branch to pick.
 */
export function setGitCommandKind(data: GitGraphData, at: number, kind: GitCommand['kind']): GitGraphData {
  const old = data.commands[at];
  if (old === undefined) throw new Error(`setGitCommandKind: no command ${at}`);
  if (old.kind === kind) return data;
  const kept = Object.fromEntries(GIT_COMMAND_FIELDS[kind].flatMap((f) => {
    const v = (old as Record<string, unknown>)[f];
    return v === undefined || (f === 'id' && (old.kind === 'cherry-pick') !== (kind === 'cherry-pick')) ? [] : [[f, v]];
  }));
  const branches = gitBranchNames(data);
  const needs: Record<string, unknown> =
    kind === 'branch' ? { name: freshName('branch', branches, branches.length, '-') }
    : kind === 'checkout' ? { name: mainOf(data) }
    : kind === 'merge' ? { branch: mergeable(data, at) }
    : kind === 'cherry-pick' ? { id: pickable(data, at) }
    : {};
  return setGitCommand(data, at, { ...needs, ...kept, kind } as GitCommand);
}

/** What replaying the commands before `at` leaves: its history, and the branch checked out. */
function replayedBefore(data: GitGraphData, at: number) {
  const history = replayGitGraph({ ...data, commands: data.commands.slice(0, at) });
  let current = mainOf(data);
  for (const c of data.commands.slice(0, history.error?.command ?? at)) if (c.kind === 'branch' || c.kind === 'checkout') current = c.name;
  return { history, current };
}

/** The latest branch made before `at` that a merge there can take in: not the one checked out, and holding a commit. */
function mergeable(data: GitGraphData, at: number): string {
  const { history, current } = replayedBefore(data, at);
  const others = history.branches.filter((b) => b.name !== current);
  const order = data.commands.slice(0, at).flatMap((c) => (c.kind === 'branch' ? [c.name] : []));
  others.sort((a, b) => order.lastIndexOf(b.name) - order.lastIndexOf(a.name));
  return (others.find((b) => b.commits.length > 0 || b.fork !== undefined) ?? others[0])?.name ?? mainOf(data);
}

/** The latest commit before `at`, named by an id of its own, that a cherry-pick there can take: not a merge, and on
 *  another branch. */
function pickable(data: GitGraphData, at: number): string {
  const { history, current } = replayedBefore(data, at);
  const named = (k: number) => (data.commands[k] as { id?: string }).id !== undefined;
  const picks = history.commits.filter((c) => c.branch !== current && c.parents.length <= 1 && c.source === undefined && named(c.command));
  return picks.at(-1)?.id ?? '';
}

const TYPES: readonly GitCommitType[] = ['NORMAL', 'REVERSE', 'HIGHLIGHT'];

/**
 * `data` with field `field` of command `at` set to `value`; `undefined` drops an optional field. Throws on a field its
 * kind does not hold, a value of the wrong type, or dropping a field the kind needs.
 */
export function setGitCommandField(data: GitGraphData, at: number, field: GitCommandField, value: string | number | undefined): GitGraphData {
  const cmd = data.commands[at];
  if (cmd === undefined) throw new Error(`setGitCommandField: no command ${at}`);
  if (!GIT_COMMAND_FIELDS[cmd.kind].includes(field)) throw new Error(`setGitCommandField: a ${cmd.kind} holds no ${field}`);
  const required = field === 'name' || field === 'branch' || (field === 'id' && cmd.kind === 'cherry-pick');
  if (value === undefined && required) throw new Error(`setGitCommandField: a ${cmd.kind} needs its ${field}`);
  if (value !== undefined && (field === 'order') !== (typeof value === 'number')) throw new Error(`setGitCommandField: ${field} takes a ${field === 'order' ? 'number' : 'string'}`);
  if (field === 'type' && value !== undefined && !TYPES.includes(value as GitCommitType)) throw new Error(`setGitCommandField: no commit type "${value}"`);
  if ((cmd as Record<string, unknown>)[field] === value) return data;
  return setGitCommand(data, at, withOptional(cmd as Record<string, unknown>, field, value) as GitCommand);
}

/** `data` drawn left to right (the default), top to bottom, or bottom to top. */
export const setGitOrientation = (data: GitGraphData, orientation: 'LR' | 'TB' | 'BT'): GitGraphData =>
  ((data.orientation ?? 'LR') === orientation ? data : withOptional(data, 'orientation', orientation === 'LR' ? undefined : orientation));

/** `data` with its main branch called `name`, trimmed, every checkout and merge of it renamed too. Throws on an empty
 *  name or one another branch holds. */
export function setGitMainBranch(data: GitGraphData, name: string): GitGraphData {
  const next = name.trim();
  const old = mainOf(data);
  if (next === old) return data;
  if (next === '') throw new Error('setGitMainBranch: a branch needs a name');
  if (gitBranchNames(data).includes(next)) throw new Error(`setGitMainBranch: a branch is already called "${next}"`);
  const commands = data.commands.map((c): GitCommand => {
    if (c.kind === 'checkout' && c.name === old) return { ...c, name: next };
    if (c.kind === 'merge' && c.branch === old) return { ...c, branch: next };
    return c;
  });
  return withOptional({ ...data, commands }, 'mainBranch', next === 'main' ? undefined : next);
}
