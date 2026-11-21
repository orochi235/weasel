import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import type { SvgGroupNode, SvgPathNode } from './types';

const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`);

describe('<use>', () => {
  it('draws the referenced shape moved by x, y and its transform, inheriting from the <use>', () => {
    const out = parse('<defs><rect id="r" width="2" height="3"/></defs><use href="#r" x="5" y="1" transform="translate(10 0)" fill="red"/>');
    expect(out.warnings).toEqual([]);
    const rect = out.nodes[0] as SvgPathNode;
    expect(rect.path).toEqual({ kind: 'rect', x: 15, y: 1, width: 2, height: 3 });
    expect(rect.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('reads xlink:href, and draws a <symbol>\'s children, which draw nothing in place', () => {
    const out = parse('<symbol id="s"><rect width="1" height="1"/><circle r="1"/></symbol><use xlink:href="#s"/>');
    expect(out.nodes.map((n) => n.kind)).toEqual(['path', 'path']);
    expect(out.warnings).toEqual([]);
  });

  it('leaves out what a container would: a hidden or failing child of a <symbol>, a foreign one, and a hidden target', () => {
    const out = parse(
      '<symbol id="s" xmlns:foo="urn:foo"><rect width="1" height="1"/><rect display="none" width="2" height="2"/>'
      + '<rect visibility="hidden" width="3" height="3"/><rect systemLanguage="zz" width="4" height="4"/><foo:bar/></symbol>'
      + '<defs><rect id="h" visibility="hidden" width="5" height="5"/></defs><use href="#s"/><use href="#h"/>',
    );
    expect(out.warnings).toEqual([]);
    expect(out.nodes.map((n) => (n as SvgPathNode).path)).toEqual([{ kind: 'rect', x: 0, y: 0, width: 1, height: 1 }]);
    const kept = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="s"><rect display="none" width="2" height="2"/></symbol><use href="#s"/></svg>',
      { keepHidden: true },
    );
    expect(kept.nodes.map((n) => n.hidden)).toEqual([true]);
  });

  it('draws a group it references, with what that group holds', () => {
    const out = parse('<g id="g"><rect width="1" height="1"/></g><use href="#g" x="4"/>');
    expect(out.nodes).toHaveLength(2);
    const copy = out.nodes[1] as SvgGroupNode;
    expect((copy.children[0] as SvgPathNode).path).toEqual({ kind: 'rect', x: 4, y: 0, width: 1, height: 1 });
  });

  it('stops at a reference cycle and at a missing target, and says so', () => {
    const out = parse('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g><use href="#self" id="self"/><use href="#none"/>');
    expect(out.warnings.some((w) => w.includes('reference cycle'))).toBe(true);
    expect(out.warnings).toContain('<use> references #none, which the document does not define');
  });
  it('counts a chain of references toward the nesting limit', () => {
    const n = 2000;
    const uses = Array.from({ length: n }, (_, i) => `<use id="u${i}" href="#u${i + 1}"/>`).join('');
    const out = parse(`<defs>${uses}<rect id="u${n}" width="1" height="1"/></defs><use href="#u0"/><rect width="2" height="2"/>`);
    expect(out.nodes.map((node) => (node as SvgPathNode).path)).toEqual([{ kind: 'rect', x: 0, y: 0, width: 2, height: 2 }]);
    expect(out.warnings.some((w) => /nest more than \d+ deep/.test(w))).toBe(true);
  });
});
