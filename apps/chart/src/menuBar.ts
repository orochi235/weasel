import { ActionDisabledReason } from '@weasel-js/core';
import { EDITOR_MENU_TITLES, type MenuTitle } from '@weasel-js/editor';

/** A command's `enabled` answer: on, or off as not applicable here. */
export const can = (yes: boolean): true | ActionDisabledReason => (yes ? true : ActionDisabledReason.NotApplicable);

/** WeaselChart's menu titles: the editor's, then Run, and Mode in every mode. Chart and pipeline mode fill them. */
export const CHART_MENU_TITLES: readonly MenuTitle[] = [
  ...EDITOR_MENU_TITLES,
  { key: 'run', title: 'Run', access: 'r' },
  { key: 'mode', title: 'Mode', access: 'm', always: true },
];
