import { actionShortcuts, type ActionItem } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';

/** The shortcut hint an entry shows: the action's own `shortcut` text, else its first binding written out. */
export function actionShortcutText(item: ActionItem): string | undefined {
  return item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0]);
}
