/** The `text` insert: an empty box opens for typing, joined to its first edit; a pasted string does not. */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TEXT_FILL } from '@weasel-js/text';
import { textEditJoin } from '../editor/sceneTextDrafts';
import { textNodeFactory } from './insert';

const BOX = { x: 0, y: 0, width: 10, height: 10 };
const deps = (startEdit: () => void) => ({ get: (name: string) => (name === 'textEdit' ? { startEdit } : undefined) }) as never;

describe('textNodeFactory', () => {
  it('makes an empty box in the default fill that opens at its caret, as one undo with its first edit', () => {
    const startEdit = vi.fn();
    const built = textNodeFactory(BOX, { kind: 'text' })!;
    expect(built.data).toEqual({ text: '', fill: DEFAULT_TEXT_FILL });
    expect(built.batch?.('n')).toEqual(textEditJoin('n'));
    built.inserted?.('n', deps(startEdit));
    expect(startEdit).toHaveBeenCalledWith('n', { caret: 0 });
  });

  it("sets the text in the tool's fill, and none for a null one", () => {
    const red = { kind: 'solid', color: '#f00' } as const;
    expect(textNodeFactory(BOX, { kind: 'text', style: { fill: red } })!.data).toEqual({ text: '', fill: { paint: red } });
    expect(textNodeFactory(BOX, { kind: 'text', style: { fill: null } })!.data).toEqual({ text: '', fill: null });
  });

  it('keeps a pasted string its own entry, and opens nothing', () => {
    const built = textNodeFactory(BOX, { kind: 'text', text: 'hi' })!;
    expect(built.data).toEqual({ text: 'hi', fill: DEFAULT_TEXT_FILL });
    expect(built.batch).toBeUndefined();
    expect(built.inserted).toBeUndefined();
  });
});
