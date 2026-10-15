import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { actionItems, type ActionItem } from '@weasel-js/routing';
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from '../clipboard/action';
import { duplicateAction } from './duplicate';
import { transformAgainAction } from '../transform-again/action';
import { groupAction, ungroupAction } from './group';
import { reorderForwardAction, reorderBackwardAction } from './reorder';
import { flipAction } from '../flip/action';
import { undoAction, redoAction } from './undoRedo';
import { deleteAction } from './delete';

function iconOf(item: ActionItem) {
  const i = item.icon;
  return typeof i === 'function' ? i() : i;
}

describe('default edit-action icons', () => {
  const items = [
    undoAction, redoAction, deleteAction,
    clipboardCutAction, clipboardCopyAction, clipboardPasteAction, duplicateAction, transformAgainAction,
    groupAction, ungroupAction, reorderForwardAction, reorderBackwardAction, flipAction,
  ].flatMap(actionItems);

  it('gives every entry an svg glyph', () => {
    expect(items.map((i) => i.key)).toEqual([
      'undo', 'redo', 'delete',
      'clipboard.cut', 'clipboard.copy', 'clipboard.paste', 'duplicate', 'transformAgain', 'group', 'ungroup',
      'reorder.forward:adjacent', 'reorder.forward:extreme',
      'reorder.backward:adjacent', 'reorder.backward:extreme',
      'flip:x', 'flip:y',
    ]);
    for (const item of items) {
      const icon = iconOf(item);
      expect(isValidElement(icon), item.key).toBe(true);
    }
  });

  it('draws each variant differently', () => {
    const glyphs = items.map((i) => {
      const el = iconOf(i) as { type: unknown };
      return el.type;
    });
    expect(new Set(glyphs).size).toBe(items.length);
  });
});
