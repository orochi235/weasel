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
});
