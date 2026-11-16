import { describe, expect, it } from 'vitest';
import { actionItems } from '@weasel-js/routing';
import { undoAction, redoAction } from './undoRedo';
import { deleteAction } from './delete';
import { icons } from '../../../icons.table';
import { icons as editingIcons } from '@weasel-js/editing/icons';

const TABLES = { [icons.namespace]: icons, [editingIcons.namespace]: editingIcons };
import { iconParts } from '@weasel-js/icons';
import { reorderForwardAction, reorderBackwardAction, flipAction, clipboardCopyAction, clipboardCutAction, clipboardPasteAction, duplicateAction, transformAgainAction, groupAction, ungroupAction } from '@weasel-js/editing';

describe('default edit-action icons', () => {
  const items = [
    undoAction, redoAction, deleteAction,
    clipboardCutAction, clipboardCopyAction, clipboardPasteAction, duplicateAction, transformAgainAction,
    groupAction, ungroupAction, reorderForwardAction, reorderBackwardAction, flipAction,
  ].flatMap(actionItems);

  it('names a glyph its namespace draws for every entry', () => {
    expect(items.map((i) => i.key)).toEqual([
      'undo', 'redo', 'delete',
      'clipboard.cut', 'clipboard.copy', 'clipboard.paste', 'duplicate', 'transformAgain', 'group', 'ungroup',
      'reorder.forward:adjacent', 'reorder.forward:extreme',
      'reorder.backward:adjacent', 'reorder.backward:extreme',
      'flip:x', 'flip:y',
    ]);
    for (const item of items) {
      const [ns, name] = (iconParts(item.icon)?.name ?? '').split(':');
      expect(TABLES[ns!]?.icons[name!], item.key).toBeDefined();
    }
  });

  it('draws each variant differently', () => {
    expect(new Set(items.map((i) => i.icon)).size).toBe(items.length);
  });
});
