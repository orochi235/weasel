/** Initial scene content for TextDemo — five text nodes covering single-line,
 *  multi-line, alignment, themed-editor styling, and inline rich-text runs. */
import type { RectPose, TextPose } from '@orochi235/weasel';

export type TextNode = TextPose & { id: string };
export type Pose = RectPose;

export const INITIAL_TEXT_NODES: TextNode[] = [
  {
    id: 't1',
    x: 30,
    y: 30,
    width: 240,
    height: 80,
    text: 'Click to select. Double-click to edit.\nDrag a selected node to move it.',
    style: { fontSize: 16, fill: { fill: 'solid', color: '#1c1c1c' } },
  },
  {
    id: 't2',
    x: 320,
    y: 60,
    width: 240,
    height: 60,
    text: 'Center-aligned.',
    style: { fontSize: 20, align: 'center', fill: { fill: 'solid', color: '#3a4a8a' }, fontWeight: 600 },
  },
  {
    id: 't3',
    x: 60,
    y: 200,
    width: 480,
    height: 40,
    text: 'Enter commits, Shift+Enter newline, Escape cancels.',
    style: { fontSize: 14, fontStyle: 'italic', fill: { fill: 'solid', color: '#6a6a6a' } },
  },
  {
    id: 't4',
    x: 60,
    y: 250,
    width: 480,
    height: 50,
    text: 'Themed editing — magenta caret, yellow ::selection.',
    style: {
      fontSize: 16,
      fontWeight: 600,
      fill: { color: '#7a1f5a' },
      caretColor: '#ff00ff',
      selectionBackground: '#ffeb3b',
      selectionColor: '#000',
    },
  },
  {
    id: 't5',
    x: 30,
    y: 310,
    width: 540,
    height: 40,
    text: 'Inline runs: bold word, italic word, bold-italic word.',
    runs: [
      { text: 'Inline runs: ' },
      { text: 'bold', bold: true },
      { text: ' word, ' },
      { text: 'italic', italic: true },
      { text: ' word, ' },
      { text: 'bold-italic', bold: true, italic: true },
      { text: ' word.' },
    ],
    style: { fontSize: 16, fill: { fill: 'solid', color: '#1c1c1c' } },
  },
];
