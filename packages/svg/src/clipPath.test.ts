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
  ])('says so when a <%s> carries one it cannot hold', (tag, body) => {
    const out = parse(body);
    expect(out.nodes).toHaveLength(1);
    expect(out.warnings).toEqual([`clip-path on <${tag}> is not modeled; only a <g> clips, so it is drawn unclipped`]);
  });

  it('says nothing about clip-path="none"', () => {
    expect(parse('<rect clip-path="none" width="9" height="9"/>').warnings).toEqual([]);
  });
});
