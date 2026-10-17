import { describe, expect, it } from 'vitest';
import { actionItems } from '@weasel-js/routing';
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from '../clipboard/action';
import { duplicateAction } from './duplicate';
import { transformAgainAction } from '../transform-again/action';
import { groupAction, ungroupAction } from './group';
import { reorderForwardAction, reorderBackwardAction } from './reorder';
import { flipAction } from '../flip/action';
import { undoAction, redoAction } from './undoRedo';
import { deleteAction } from './delete';
import { icons } from '../../../icons.table';

describe('default edit-action icons', () => {
  const items = [
    undoAction, redoAction, deleteAction,
    clipboardCutAction, clipboardCopyAction, clipboardPasteAction, duplicateAction, transformAgainAction,
    groupAction, ungroupAction, reorderForwardAction, reorderBackwardAction, flipAction,
  ].flatMap(actionItems);

  it('names a core glyph for every entry', () => {
    expect(items.map((i) => i.key)).toEqual([
      'undo', 'redo', 'delete',
      'clipboard.cut', 'clipboard.copy', 'clipboard.paste', 'duplicate', 'transformAgain', 'group', 'ungroup',
      'reorder.forward:adjacent', 'reorder.forward:extreme',
      'reorder.backward:adjacent', 'reorder.backward:extreme',
      'flip:x', 'flip:y',
    ]);
    for (const item of items) {
      const [ns, name] = (item.icon ?? '').split(':');
      expect(ns, item.key).toBe('core');
      expect(icons.icons[name!], item.key).toBeDefined();
    }
  });

  it('draws each variant differently', () => {
    expect(new Set(items.map((i) => i.icon)).size).toBe(items.length);
  });
});
