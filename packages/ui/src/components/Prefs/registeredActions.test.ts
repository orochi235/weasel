import { actionItems, type Action } from '@weasel-js/core';
import type { PrefActions } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { actionsLeafActions } from './registeredActions';

const run = () => {};
const act = (id: string): Action => ({ id, label: id, group: 'arrange', invoker: { timing: 'immediate', run } });
const leaf: PrefActions = { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange' };
const all = [act('a'), act('b'), act('c')];

describe('actionsLeafActions order', () => {
  it('draws the named actions first and the rest after, in registry order', () => {
    const keys = actionsLeafActions({ ...leaf, order: ['b'] }, all).map((a) => a.action);
    expect(keys).toEqual(['b', 'a', 'c']);
  });
  it('keeps registry order with no order', () => {
    expect(actionsLeafActions(leaf, all).map((a) => a.action)).toEqual(['a', 'b', 'c']);
  });
  it('keeps every copy of a key listed twice, drawn together where the order puts it', () => {
    const pick = (list: readonly Action[]) => [list[0]!, list[1]!, list[0]!, list[2]!].flatMap(actionItems);
    const keys = actionsLeafActions({ ...leaf, order: ['c', 'a'] }, all, { pick }).map((a) => a.action);
    expect(keys).toEqual(['c', 'a', 'a', 'b']);
  });
});
