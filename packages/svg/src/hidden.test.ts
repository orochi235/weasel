import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';

const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const RECT = '<rect width="1" height="1"/>';

describe('content SVG does not render', () => {
  it('leaves out a group with display="none"', () => {
    const out = parse(`<g display="none">${RECT}</g>`);
    expect(out.nodes).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it('reads display from a style attribute and a stylesheet', () => {
    expect(parse(`<g style="display:none">${RECT}</g>${RECT}`).nodes).toHaveLength(1);
    expect(parse(`<style>.off { display: none }</style><g class="off">${RECT}</g>`).nodes).toEqual([]);
  });

  it('does not inherit display into a sibling or out of a leaf', () => {
    const out = parse(`<rect display="none" width="1" height="1"/>${RECT}<text display="none">a</text>`);
    expect(out.nodes.map((n) => n.kind)).toEqual(['path']);
  });

  it('leaves out leaves under visibility="hidden", except one that turns itself back on', () => {
    const out = parse(
      `<g visibility="hidden">${RECT}<circle r="2" visibility="visible"/>`
      + '<text>a</text><image width="1" height="1" href="a.png"/></g>',
    );
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0]).toMatchObject({ kind: 'group', children: [{ kind: 'path' }] });
    const group = out.nodes[0] as { children: unknown[] };
    expect(group.children).toHaveLength(1);
  });

  it('treats visibility="collapse" as hidden', () => {
    expect(parse('<rect visibility="collapse" width="1" height="1"/>').nodes).toEqual([]);
  });

  it('still paints from a gradient defined inside a hidden group', () => {
    const out = parse(
      '<g display="none"><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></g>'
      + '<rect width="1" height="1" fill="url(#g)"/>',
    );
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0]).toMatchObject({ fill: { kind: 'gradient' } });
  });
});
