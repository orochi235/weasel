import { describe, it, expect } from 'vitest';
import { held, key } from '@weasel-js/gestures';
import type { Action } from '../interactions/actions/action';
import { buildToolOffhandBindings, createToolOffhandAction } from '../interactions/actions/toolOffhand';
import { describeShortcuts } from './describeShortcuts';
import { TOOL_ACTIVATE_ID } from './toolShortcuts';
import { toolSet } from './toolSet';

const run = { timing: 'immediate' as const, run: () => {} };
const tool = (label: string) => ({ presentation: { label } });

const tools = { select: tool('Select'), rect: tool('Rectangle'), hand: tool('Hand'), pen: tool('Pen') };

const actions: Action[] = [
  {
    id: TOOL_ACTIVATE_ID, label: 'Activate tool', invoker: run,
    defaultBinding: [
      { spec: key('V'), opts: { params: { toolId: 'select' } } },
      { spec: key('R'), opts: { params: { toolId: 'rect' } } },
    ],
  },
  createToolOffhandAction(buildToolOffhandBindings([{ toolId: 'hand', key: ' ' }])),
  { id: 'undo', label: 'Undo', group: 'history', invoker: run, defaultBinding: key('Mod+Z') },
  {
    id: 'flip', label: 'Flip', group: 'arrange', invoker: run,
    variants: [{ key: 'x', label: 'Flip Horizontal', params: { axis: 'x' } }, { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } }],
    defaultBinding: [{ spec: key('Shift+H'), opts: { params: { axis: 'x' } } }],
  },
  { id: 'peek', label: 'Peek', invoker: { timing: 'ongoing', start: () => ({}) }, defaultBinding: held('Z') },
  { id: 'unbound', label: 'Unbound', group: 'history', invoker: run },
];

describe('describeShortcuts', () => {
  it('groups tools by the sets given, then the rest under "Other tools", keyed or not', () => {
    const d = describeShortcuts(actions, { tools, toolSets: [toolSet('pick', ['select'], { label: 'Pick' }), toolSet('make', ['rect', 'pen'])] });
    expect(d.tools.map((g) => [g.label, g.rows.map((r) => [r.label, r.shortcuts.map((s) => s.key)])])).toEqual([
      ['Pick', [['Select', ['V']]]],
      ['Make', [['Rectangle', ['R']], ['Pen', []]]],
      ['Other tools', [['Hand', []]]],
    ]);
  });

  it('lists each command entry with a pressed key under its group, variants by their own label', () => {
    const d = describeShortcuts(actions);
    expect(d.commands.map((g) => [g.label, g.rows.map((r) => r.label)])).toEqual([
      ['History', ['Undo']],
      ['Arrange', ['Flip Horizontal']],
    ]);
    expect(d.tools).toEqual([]);
  });

  it('lists held keys apart: a tool held on its key by name, and a keyHeld action', () => {
    const d = describeShortcuts(actions, { tools });
    expect(d.held.map((r) => [r.label, r.shortcuts[0]!.key])).toEqual([['Hand', ' '], ['Peek', 'Z']]);
  });
});
