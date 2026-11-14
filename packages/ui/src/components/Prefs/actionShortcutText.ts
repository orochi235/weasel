import { actionItemShortcuts, type ActionItem } from '@weasel-js/core';
import { formatShortcut } from '@weasel-js/gestures';

/** An entry's shortcut as one line of text: its declared text, else its first binding written out. */
export function actionShortcutText(item: ActionItem): string | undefined {
  const shown = actionItemShortcuts(item);
  return typeof shown === 'string' ? shown : formatShortcut(shown[0]);
}
