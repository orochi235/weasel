import { describe, expect, it } from 'vitest';
import { parseSvg, serializeSvg } from './index';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`;

describe('an element id', () => {
  it('is kept on the node each element parses to', () => {
    const { nodes } = parseSvg(svg('<g id="g"><rect id="r" width="1" height="1"/><circle r="1"/></g><text id="t">hi</text>'));
    expect(nodes.map((n) => n.id)).toEqual(['g', 't']);
    const group = nodes[0];
    expect(group.kind === 'group' && group.children.map((c) => c.id)).toEqual(['r', undefined]);
  });

  it("is the <use>'s on what a <use> draws, never the copied element's", () => {
    const { nodes } = parseSvg(svg('<rect id="r" width="1" height="1"/><use id="u" href="#r" x="5"/><use href="#r" x="9"/>'));
    expect(nodes.map((n) => n.id)).toEqual(['r', 'u', undefined]);
  });

  it('is written back, and read back the same', () => {
    const { nodes } = parseSvg(svg('<g id="a&amp;b"><path id="p" d="M0 0L1 1" stroke="#000"/></g>'));
    const out = serializeSvg(nodes);
    expect(out).toContain('id="a&amp;b"');
    expect(parseSvg(out).nodes.map((n) => n.id)).toEqual(['a&b']);
  });
});
