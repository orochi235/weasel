/** Initial scene content for TextDemo — six text nodes covering single-line,
 *  multi-line, alignment, themed-editor styling, inline rich-text runs, and
 *  run-level decoration + tracking. */
import type { RectPose, TextPose } from '@weasel-js/core';

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
    // The only scene that pins decoration geometry and tracking by pixels.
    // Underline / strikethrough offsets and rule weight are derived constants
    // (0.10 / -0.30 / 0.05 em) rather than font metrics — the BmFont atlas
    // doesn't carry `underlinePosition` — so this baseline is what would
    // catch them drifting. Keep the three effects on separate runs: a single
    // run carrying all of them can't show that the rules are per-span.
    id: 't6',
    x: 30,
    y: 130,
    width: 540,
    height: 60,
    text: 'Underline, strikethrough, and tracking.',
    runs: [
      { text: 'Underline', underline: true },
      { text: ', ' },
      { text: 'strikethrough', strikethrough: true },
      { text: ', and ' },
      { text: 'tracking', letterSpacing: 3 },
      { text: '.' },
    ],
    style: { fontSize: 16, fill: { fill: 'solid', color: '#1c1c1c' } },
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
