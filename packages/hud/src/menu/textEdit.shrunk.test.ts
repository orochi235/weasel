/** Counterexamples `textEdit.pbt.test.ts` shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import type { MenuTextEntry } from '@weasel-js/menu';
import { editKey, startEdit } from './textEdit';

const entry = { kind: 'text', key: 'name', label: 'Name' } as MenuTextEntry;

describe('textEdit counterexamples', () => {
  it('types a key that is one cluster of several code points', () => {
    expect(editKey(startEdit(entry, ''), 'a🏽').edit).toMatchObject({ draft: 'a🏽', caret: 2, anchor: 2 });
    expect(editKey(startEdit(entry, 'x'), '👍🏽').edit).toMatchObject({ draft: 'x👍🏽', caret: 3 });
  });

  it('deletes a word back to a cluster boundary, never into a cluster', () => {
    expect(editKey(startEdit(entry, ' ́'), 'Backspace', { word: true }).edit).toMatchObject({ draft: '', caret: 0 });
    expect(editKey({ ...startEdit(entry, 'a🏽b'), caret: 0, anchor: 0 }, 'Delete', { word: true }).edit)
      .toMatchObject({ draft: 'b', caret: 0 });
  });
});
