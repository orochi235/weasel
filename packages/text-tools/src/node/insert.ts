/** How a text node is inserted: what `textPreset` gives the canvas's `insert` dep for `text`, and the hooks a node
 *  made to be typed into commits with. */
import { DEFAULT_TEXT_FILL } from '@weasel-js/text';
import type { InsertedNode, InsertNodeFactory, InsertStyle } from '@weasel-js/core';
import { textEditJoin } from '../editor/sceneTextDrafts';
import type {} from '../editor/textEditDep';

/**
 * `data` inserted: an empty node is made to be typed into, so its commit opens the run its first edit joins (one
 * undo takes the node and its text together) and drops into its caret. One arriving with text, as a paste does,
 * is its own entry and opens nothing.
 */
export function typeIn(data: { text: string }): InsertedNode {
  if (data.text !== '') return { data };
  return {
    data,
    batch: textEditJoin,
    inserted: (id, deps) => deps.get('textEdit')?.startEdit(id, { caret: 0 }),
  };
}

/** The `text` insert: an empty box you then type into, or a pasted string, set in the tool's fill. The `kit:text`
 *  painter applies the style's defaults when it draws. */
export const textNodeFactory: InsertNodeFactory = (_bounds, extras) => {
  const e = extras as Partial<{ text: string; style: InsertStyle }>;
  const fill = e.style?.fill;
  return typeIn({ text: e.text ?? '', fill: fill === undefined ? DEFAULT_TEXT_FILL : fill && { paint: fill } } as { text: string });
};
