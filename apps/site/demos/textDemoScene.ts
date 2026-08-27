/** Initial scene content for TextDemo — six text nodes covering single-line,
 *  multi-line, alignment, themed-editor styling, inline rich-text runs, and
 *  run-level decoration + tracking. */
import { solid } from '@weasel-js/core';
import type { RectPose, TextPose } from '@weasel-js/core';

/** Paint is node data, not typography: `TextPose` carries `fill`/`stroke`
 *  beside `text`, the same slots a shape node uses. */
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
    fill: solid('#1c1c1c'),
    style: { fontSize: 16 },
  },
  {
    id: 't2',
    x: 320,
    y: 60,
    width: 240,
    height: 60,
    text: 'Center-aligned.',
    fill: solid('#3a4a8a'),
    style: { fontSize: 20, align: 'center', fontWeight: 600 },
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
    fill: solid('#1c1c1c'),
    style: { fontSize: 16 },
  },
  {
    id: 't3',
    x: 60,
    y: 200,
    width: 480,
    height: 40,
    text: 'Enter commits, Shift+Enter newline, Escape cancels.',
    fill: solid('#6a6a6a'),
    style: { fontSize: 14, fontStyle: 'italic' },
  },
  {
    id: 't4',
    x: 60,
    y: 250,
    width: 480,
    height: 50,
    text: 'Themed editing — magenta caret, yellow ::selection.',
    fill: solid('#7a1f5a'),
    style: {
      fontSize: 16,
      fontWeight: 600,
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
    fill: solid('#1c1c1c'),
    style: { fontSize: 16 },
  },
];
