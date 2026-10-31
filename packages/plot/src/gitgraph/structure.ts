/** Edits to a gitgraph's commands as a collection, each command's fields, and the graph's options, as plain data in and
 *  out. */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
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
 * and the old did not hold is filled in: a fresh name for a branch, the main branch to check out, the last branch
 * created to merge, the last commit id to pick.
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
  const ids = data.commands.flatMap((c) => ((c.kind === 'commit' || c.kind === 'merge') && c.id !== undefined ? [c.id] : []));
  const needs: Record<string, unknown> =
    kind === 'branch' ? { name: freshName('branch', branches, branches.length, '-') }
    : kind === 'checkout' ? { name: mainOf(data) }
    : kind === 'merge' ? { branch: branches[branches.length - 1] }
    : kind === 'cherry-pick' ? { id: ids[ids.length - 1] ?? '' }
    : {};
  return setGitCommand(data, at, { ...needs, ...kept, kind } as GitCommand);
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
