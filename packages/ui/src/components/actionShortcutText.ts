import { actionShortcuts, type ActionItem } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';

/** The shortcut hint an entry shows: its own `shortcut` text (the variant's, else the action's), else its first
 *  binding written out. */
export function actionShortcutText(item: ActionItem): string | undefined {
  return item.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0]);
}
