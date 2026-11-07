import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import type { SvgGroupNode } from './types';

const CLIP = '<clipPath id="c"><rect x="1" y="2" width="3" height="4"/></clipPath>';
const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${CLIP}${body}</svg>`);
const INNER = '<rect width="9" height="9"/>';

describe('clip-path', () => {
  it('clips a group from the attribute', () => {
    const out = parse(`<g clip-path="url(#c)">${INNER}</g>`);
    expect((out.nodes[0] as SvgGroupNode).clip).toEqual({ kind: 'rect', x: 1, y: 2, width: 3, height: 4 });
    expect(out.warnings).toEqual([]);
  });

  it('clips a group from a style attribute and from a stylesheet', () => {
    const want = { kind: 'rect', x: 1, y: 2, width: 3, height: 4 };
    expect((parse(`<g style="clip-path:url(#c)">${INNER}</g>`).nodes[0] as SvgGroupNode).clip).toEqual(want);
    expect((parse(`<style>.k { clip-path: url(#c) }</style><g class="k">${INNER}</g>`).nodes[0] as SvgGroupNode).clip)
      .toEqual(want);
  });

  it.each([
    ['path', '<path clip-path="url(#c)" d="M0 0h9v9z"/>'],
    ['rect', '<rect style="clip-path:url(#c)" width="9" height="9"/>'],
    ['image', '<image clip-path="url(#c)" width="9" height="9" href="a.png"/>'],
    ['text', '<text clip-path="url(#c)">a</text>'],
  ])('clips a <%s> by wrapping it in a clipped group', (_tag, body) => {
    const out = parse(body);
    expect(out.warnings).toEqual([]);
    expect(out.nodes).toHaveLength(1);
    const g = out.nodes[0] as SvgGroupNode;
    expect(g.kind).toBe('group');
    expect(g.clip).toEqual({ kind: 'rect', x: 1, y: 2, width: 3, height: 4 });
    expect(g.children).toHaveLength(1);
  });

  it("reads a leaf's clip in the leaf's own user space, its transform included", () => {
    const out = parse(
      '<g transform="translate(10 0)"><rect clip-path="url(#c)" transform="translate(0 20)" width="9" height="9"/></g>',
    );
    const g = (out.nodes[0] as SvgGroupNode).children[0] as SvgGroupNode;
    expect(g.clip).toEqual({ kind: 'rect', x: 11, y: 22, width: 3, height: 4 });
  });

  it('keeps a hidden clipped leaf hidden', () => {
    const out = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${CLIP}<rect clip-path="url(#c)" display="none" width="9" height="9"/></svg>`,
      { keepHidden: true },
    );
    expect(out.nodes[0]!.hidden).toBe(true);
  });

  it('says nothing about clip-path="none"', () => {
    expect(parse('<rect clip-path="none" width="9" height="9"/>').warnings).toEqual([]);
  });
});
