import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';

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

const keep = (body: string) =>
  parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, { keepHidden: true });

describe('keepHidden imports what SVG does not render, marked hidden', () => {
  it('keeps a display="none" group and its children, with the flag on the group alone', () => {
    const out = keep(`<g display="none">${RECT}</g>${RECT}`);
    expect(out.nodes).toMatchObject([{ kind: 'group', hidden: true, children: [{ kind: 'path' }] }, { kind: 'path' }]);
    const group = out.nodes[0] as { children: { hidden?: boolean }[] };
    expect(group.children[0].hidden).toBeUndefined();
    expect(out.nodes[1].hidden).toBeUndefined();
  });

  it('marks each leaf visibility hides, and not the one that turns itself back on', () => {
    const out = keep(`<g visibility="hidden">${RECT}<circle r="2" visibility="visible"/><text>a</text></g>`);
    const group = out.nodes[0] as { hidden?: boolean; children: { hidden?: boolean }[] };
    expect(group.hidden).toBeUndefined();
    expect(group.children.map((c) => c.hidden)).toEqual([true, undefined, true]);
  });

  it('writes a hidden node with display="none" and reads it back hidden', () => {
    const xml = serializeSvg(keep(`<rect display="none" width="4" height="4"/><text visibility="hidden">a</text>`).nodes);
    expect(xml.match(/display="none"/g)).toHaveLength(2);
    expect(parseSvg(xml).nodes).toEqual([]);
    expect(parseSvg(xml, { keepHidden: true }).nodes.map((n) => n.hidden)).toEqual([true, true]);
  });

  it('leaves hidden nodes out of the computed viewBox', () => {
    const xml = serializeSvg(keep(`${RECT}<rect display="none" x="50" width="4" height="4"/>`).nodes);
    expect(xml).toContain('viewBox="0 0 1 1"');
  });

  it('carries the flag onto the draft of a hidden leaf and a hidden container', () => {
    const out = keep(`<g display="none">${RECT}</g><rect visibility="hidden" width="1" height="1"/>${RECT}`);
    let n = 0;
    const drafts = svgNodesToKitDrafts(out.nodes, () => `n${n++}`);
    expect(drafts.map((d) => [d.kind, d.hidden])).toEqual([
      ['group', true], ['mark', undefined], ['mark', true], ['mark', undefined],
    ]);
  });
});
