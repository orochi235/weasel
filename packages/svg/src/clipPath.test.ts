import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
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

  it("applies the <clipPath>'s own transform to its shape", () => {
    const out = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><clipPath id="t" transform="translate(100 0)">'
      + `<rect width="3" height="4" transform="translate(0 10)"/></clipPath><g clip-path="url(#t)">${INNER}</g></svg>`,
    );
    expect((out.nodes[0] as SvgGroupNode).clip).toEqual({ kind: 'rect', x: 100, y: 10, width: 3, height: 4 });
  });

  it('reads clip-rule, from the shape or the <clipPath>, and writes it back', () => {
    const HOLE = '<path d="M0 0h10v10h-10zM2 2h2v2h-2z"/>';
    for (const def of [
      `<clipPath id="e">${HOLE.replace('<path', '<path clip-rule="evenodd"')}</clipPath>`,
      `<clipPath id="e" clip-rule="evenodd">${HOLE}</clipPath>`,
    ]) {
      const out = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${def}<g clip-path="url(#e)">${INNER}</g></svg>`);
      const clip = (out.nodes[0] as SvgGroupNode).clip as { fillRule?: string };
      expect(clip.fillRule).toBe('evenodd');
      const again = parseSvg(serializeSvg(out.nodes));
      expect(((again.nodes[0] as SvgGroupNode).clip as { fillRule?: string }).fillRule).toBe('evenodd');
    }
  });

  it('says nothing about clip-path="none"', () => {
    expect(parse('<rect clip-path="none" width="9" height="9"/>').warnings).toEqual([]);
  });
});
