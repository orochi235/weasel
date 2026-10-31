/** A gitgraph as its options and one table of commands, each column applying to the kinds of command that hold it. */
import { choiceOf, integerOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotSchema, PlotValueType } from '../editing/schemaTypes';
import {
  GIT_COMMAND_FIELDS, GIT_COMMAND_KINDS, insertGitCommand, moveGitCommand, removeGitCommand, setGitCommandField, setGitCommandKind,
  setGitMainBranch, setGitOrientation, type GitCommandField,
} from './structure';
import type { GitCommand, GitGraphData } from './types';

const ORIENTATIONS = ['LR', 'TB', 'BT'] as const;

/** The field a command's target column reads: the branch it creates, checks out, or merges, or the commit it picks. */
const targetOf = (cmd: GitCommand): GitCommandField | null =>
  (cmd.kind === 'branch' || cmd.kind === 'checkout' ? 'name' : cmd.kind === 'merge' ? 'branch' : cmd.kind === 'cherry-pick' ? 'id' : null);

/** A column over `field` (or, for `'target'`, whichever field {@link targetOf} names) on the commands that hold it. */
function column(key: string, label: string, type: PlotValueType, field: GitCommandField | 'target', optional: boolean): PlotColumn<GitGraphData> {
  const fieldOf = (d: GitGraphData, r: number): GitCommandField | null => {
    const cmd = d.commands[r];
    if (cmd === undefined) return null;
    if (field === 'target') return targetOf(cmd);
    if (field === 'id' && cmd.kind === 'cherry-pick') return null;
    return GIT_COMMAND_FIELDS[cmd.kind].includes(field) ? field : null;
  };
  return {
    key, label, type, optional,
    applies: (d, _, r) => fieldOf(d, r) !== null,
    get: (d, _, r) => { const f = fieldOf(d, r); return f === null ? undefined : (d.commands[r] as Record<string, string | number | undefined>)[f]; },
    set: (d, _, r, v) => {
      const f = fieldOf(d, r);
      if (f === null) return d;
      const value = f === 'order' ? integerOf(v) : textOf(v)?.trim() || undefined;
      if (value === undefined && (v !== undefined || !optional)) return d;
      if (f === 'type' && value !== undefined && type.kind === 'enum' && !type.options.includes(String(value))) return d;
      return setGitCommandField(d, r, f, value);
    },
  };
}

export const gitgraphSchema: PlotSchema<GitGraphData> = {
  fields: [
    titleField(),
    {
      key: 'orientation', label: 'Orientation', type: { kind: 'enum', options: ORIENTATIONS },
      get: (d) => d.orientation ?? 'LR',
      set: (d, v) => { const o = choiceOf(v, ORIENTATIONS); return o ? setGitOrientation(d, o) : d; },
    },
    {
      key: 'mainBranch', label: 'Main branch', type: { kind: 'string' },
      get: (d) => d.mainBranch ?? 'main',
      set: (d, v) => {
        const name = textOf(v)?.trim();
        if (!name) return d;
        try { return setGitMainBranch(d, name); } catch { return d; }
      },
    },
  ],
  tables: [{
    key: 'commands', label: 'Commands', item: 'command',
    count: (d) => d.commands.length,
    columns: () => [
      {
        key: 'kind', label: 'Command', type: { kind: 'enum', options: GIT_COMMAND_KINDS },
        get: (d, _, r) => d.commands[r]?.kind,
        set: (d, _, r, v) => { const k = choiceOf(v, GIT_COMMAND_KINDS); return k ? setGitCommandKind(d, r, k) : d; },
      },
      column('target', 'Branch or commit', { kind: 'string' }, 'target', false),
      column('id', 'Id', { kind: 'string' }, 'id', true),
      column('type', 'Type', { kind: 'enum', options: ['NORMAL', 'REVERSE', 'HIGHLIGHT'] }, 'type', true),
      column('tag', 'Tag', { kind: 'string' }, 'tag', true),
      column('message', 'Message', { kind: 'string' }, 'message', true),
      column('order', 'Order', { kind: 'number', step: 1 }, 'order', true),
      column('parent', 'Parent', { kind: 'string' }, 'parent', true),
    ],
    insert: (d, _, at) => insertGitCommand(d, at),
    remove: (d, _, r) => removeGitCommand(d, r),
    move: (d, _, from, to) => moveGitCommand(d, from, to),
    rowLabel: (d, _, r) => { const c = d.commands[r]; return c === undefined ? '' : [c.kind, ...(targetOf(c) ? [(c as Record<string, string>)[targetOf(c)!]] : [])].join(' '); },
  }],
};
