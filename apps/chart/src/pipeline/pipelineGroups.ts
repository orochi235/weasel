import { useCommand } from '@weasel-js/core';
import type { EffectEditorApi } from '@weasel-js/diagram/effect';
import type { RefObject } from 'react';
import { can, run, type MenuRuns } from '../menuBar';

export const GROUP_ACTIONS = { group: 'pipeline.group', ungroup: 'pipeline.ungroup' } as const;

/** Pipeline mode's Arrange menu. */
export const ARRANGE_MENU: MenuRuns = {
  groups: run({ group: GROUP_ACTIONS.group, ungroup: GROUP_ACTIONS.ungroup }),
};

/** What is picked in the editor, and how to pick a group. */
export interface GroupPicks {
  stage: string | null;
  group: string | null;
  /** Every stage and group picked, Shift-clicks included. */
  picked: readonly string[];
  pickGroup: (id: string | null) => void;
}

/** Registers Arrange › Group, which groups every picked stage and group and picks the new group, and
 *  Ungroup, which dissolves the picked group. */
export function useGroupCommands(editor: RefObject<EffectEditorApi | null>, picks: GroupPicks): void {
  const { stage, group, picked, pickGroup } = picks;
  const target = stage ?? group;
  const ids = picked.length > 0 ? picked : target === null ? [] : [target];
  useCommand(GROUP_ACTIONS.group, 'Group', () => {
    const made = ids.length === 0 ? null : editor.current?.group(ids) ?? null;
    if (made !== null) pickGroup(made);
  }, { enabled: () => can(ids.length > 0), keys: { kind: 'key', key: 'g', mods: { mod: true } } });
  useCommand(GROUP_ACTIONS.ungroup, 'Ungroup', () => {
    if (group === null) return;
    editor.current?.ungroup(group);
    pickGroup(null);
  }, { enabled: () => can(group !== null), keys: { kind: 'key', key: 'g', mods: { mod: true, shift: true } } });
}
