import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import type { SvgGroupNode, SvgNode } from './types';

const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const kinds = (nodes: SvgNode[]): unknown[] =>
  nodes.map((n) => (n.kind === 'group' ? kinds((n as SvgGroupNode).children) : n.kind));

describe('conditional processing', () => {
  it('reads <a> as a group, keeping what it holds', () => {
    const out = parse('<a href="https://example.com" opacity="0.5"><rect width="1" height="1"/></a>');
    expect(kinds(out.nodes)).toEqual([['path']]);
    expect((out.nodes[0] as SvgGroupNode).opacity).toBe(0.5);
    expect(out.warnings).toEqual(['<a> is read as a group; its link is not kept']);
  });

  it('draws only the first child of a <switch> whose conditions hold', () => {
    const out = parse(
      '<switch><rect requiredExtensions="http://example.com/x" width="1" height="1"/>'
      + '<text systemLanguage="zz">a</text><circle r="1"/><rect width="1" height="1"/></switch>',
    );
    expect(kinds(out.nodes)).toEqual([['path']]);
    expect(out.warnings).toEqual([]);
  });

  it('takes the fallback after a <foreignObject> in a <switch>', () => {
    const out = parse(
      '<switch><foreignObject width="9" height="9"><div xmlns="http://www.w3.org/1999/xhtml">a</div></foreignObject>'
      + '<text x="0" y="9">a</text></switch>',
    );
    expect(kinds(out.nodes)).toEqual([['text']]);
  });

  it('leaves out an element outside a <switch> whose conditions fail', () => {
    expect(parse('<rect systemLanguage="zz" width="1" height="1"/><rect width="1" height="1"/>').nodes).toHaveLength(1);
  });
});
