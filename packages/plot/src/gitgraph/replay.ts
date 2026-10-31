/** A git graph's commands replayed into its history: the commits each made, and the branches they sit on. */
import type { GitCommand, GitCommitType, GitGraphData } from './types';

/** One commit, as the replay made it. */
export interface GitCommit {
  /** The index in `commands` of the command that made it. */
  command: number;
  /** The command's own id, else one the replay gave it. */
  id: string;
  branch: string;
  /** Its place in the whole history, from 0. */
  seq: number;
  /** The commit it follows, then for a merge the one it merges. */
  parents: readonly string[];
  type: GitCommitType;
  /** For a cherry-pick, the commit it copies. */
  source?: string;
}

/** One branch: its name, where it forked, and its commits in order. */
export interface GitBranch {
  name: string;
  order?: number;
  /** The commit it was branched from; none for the main branch, or one branched before any commit. */
  fork?: string;
  commits: string[];
}

/** A replayed history. `branches` in lane order: the main branch first, then by `order`, then as created. */
export interface GitHistory {
  commits: GitCommit[];
  branches: GitBranch[];
  /** The first command that could not run, and why; the history holds what ran before it. */
  error?: { command: number; message: string };
}

interface ReplayState {
  history: GitHistory;
  byId: Map<string, GitCommit>;
  branches: Map<string, GitBranch & { created: number }>;
  current: string;
}

/** A branch's latest commit, else the one it forked from. */
const headOf = (s: ReplayState, branch: string): string | undefined => {
  const b = s.branches.get(branch);
  return b?.commits.at(-1) ?? b?.fork;
};

/** Adds a commit to the current branch. Returns why it cannot, or `null`. */
function add(s: ReplayState, command: number, id: string | undefined, rest: Omit<GitCommit, 'command' | 'id' | 'branch' | 'seq'>): string | null {
  const seq = s.history.commits.length;
  const name = id ?? `#${seq}`;
  if (s.byId.has(name)) return `a commit "${name}" already exists`;
  const commit: GitCommit = { command, id: name, branch: s.current, seq, ...rest };
  s.history.commits.push(commit);
  s.byId.set(name, commit);
  s.branches.get(s.current)!.commits.push(name);
  return null;
}

function merge(s: ReplayState, k: number, cmd: Extract<GitCommand, { kind: 'merge' }>): string | null {
  const other = cmd.branch;
  const head = headOf(s, s.current);
  if (other === s.current) return `"${other}" cannot be merged into itself`;
  if (head === undefined) return `cannot merge into "${s.current}": it has no commits`;
  if (!s.branches.has(other)) return `cannot merge "${other}": there is no such branch`;
  const theirs = headOf(s, other);
  if (theirs === undefined) return `cannot merge "${other}": it has no commits`;
  if (theirs === head) return `cannot merge "${other}" into "${s.current}": both have the same head`;
  return add(s, k, cmd.id, { parents: [head, theirs], type: cmd.type ?? 'NORMAL' });
}

function cherryPick(s: ReplayState, k: number, cmd: Extract<GitCommand, { kind: 'cherry-pick' }>): string | null {
  const source = s.byId.get(cmd.id);
  const head = headOf(s, s.current);
  if (source === undefined) return `cannot cherry-pick "${cmd.id}": there is no such commit`;
  if (source.branch === s.current) return `cannot cherry-pick "${cmd.id}": it is already on "${s.current}"`;
  if (head === undefined) return `cannot cherry-pick onto "${s.current}": it has no commits`;
  if (source.parents.length > 1 && (cmd.parent === undefined || !source.parents.includes(cmd.parent))) {
    return `cherry-picking the merge "${cmd.id}" needs a parent, one of ${source.parents.map((p) => `"${p}"`).join(', ')}`;
  }
  if (source.parents.length <= 1 && cmd.parent !== undefined) return `"${cmd.id}" is not a merge, so takes no parent`;
  return add(s, k, undefined, { parents: [head], type: 'NORMAL', source: source.id });
}

/** Runs one command. Returns why it cannot, or `null`. */
function step(s: ReplayState, k: number, cmd: GitCommand): string | null {
  switch (cmd.kind) {
    case 'commit': {
      const head = headOf(s, s.current);
      return add(s, k, cmd.id, { parents: head === undefined ? [] : [head], type: cmd.type ?? 'NORMAL' });
    }
    case 'branch': {
      if (s.branches.has(cmd.name)) return `a branch "${cmd.name}" already exists; check it out instead`;
      const fork = headOf(s, s.current);
      s.branches.set(cmd.name, {
        name: cmd.name, created: s.branches.size, commits: [],
        ...(cmd.order !== undefined ? { order: cmd.order } : {}), ...(fork !== undefined ? { fork } : {}),
      });
      s.current = cmd.name;
      return null;
    }
    case 'checkout':
      if (!s.branches.has(cmd.name)) return `cannot check out "${cmd.name}": there is no such branch; create it with "branch ${cmd.name}"`;
      s.current = cmd.name;
      return null;
    case 'merge': return merge(s, k, cmd);
    case 'cherry-pick': return cherryPick(s, k, cmd);
  }
}

/** Replays `data`'s commands from an empty main branch, stopping at the first one that cannot run, as Mermaid does. */
export function replayGitGraph(data: GitGraphData): GitHistory {
  const main = data.mainBranch ?? 'main';
  const s: ReplayState = {
    history: { commits: [], branches: [] }, byId: new Map(), current: main,
    branches: new Map([[main, { name: main, created: 0, commits: [] }]]),
  };
  for (let k = 0; k < data.commands.length; k++) {
    const error = step(s, k, data.commands[k]!);
    if (error !== null) {
      s.history.error = { command: k, message: error };
      break;
    }
  }
  const rank = (b: GitBranch & { created: number }) => (b.name === main ? Number.NEGATIVE_INFINITY : b.order ?? b.created);
  s.history.branches = [...s.branches.values()]
    .sort((a, b) => rank(a) - rank(b) || a.created - b.created)
    .map(({ created: _, ...b }) => b);
  return s.history;
}
