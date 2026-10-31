import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from '../document';
import { DRAW_XML } from './format';
import { asGraph } from '../testing/asGraph';

const doc = (style: { bold?: boolean; italic?: boolean }): DiagramDocument => ({
  pages: [{ kind: 'graph', id: 'p', width: 400, height: 300, data: { nodes: [{ id: 'n', rows: [{ kind: 'label', text: 'Shape', style: { fontSize: 14, ...style } }] }], edges: [] } }],
  theme: 'paper',
});

describe('an italic row through draw-style XML', () => {
  it.each([
    [{ italic: true }, '2'],
    [{ bold: true, italic: true }, '3'],
  ])('writes %o as fontStyle %s and reads it back', async (style, bits) => {
    const { text } = DRAW_XML.write!(doc(style));
    expect(text).toContain(`fontStyle=${bits}`);
    const { document } = await DRAW_XML.read!(text);
    expect(document.pages.map(asGraph)[0]!.data.nodes[0]!.rows![0]).toMatchObject({ style: { fontSize: 14, ...style } });
  });
});
