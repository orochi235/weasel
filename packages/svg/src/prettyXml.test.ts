import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg } from './index';
import type { SvgNode } from './types';

const rect = (x: number): SvgNode => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: 10, height: 10 },
  fill: { kind: 'solid', color: '#123456' },
});

const NODES: SvgNode[] = [
  { kind: 'group', children: [rect(0), { kind: 'group', children: [rect(20)] }] },
  rect(40),
];

describe('serializeSvg pretty', () => {
  it('puts each element on its own line, indented by depth', () => {
    const out = serializeSvg(NODES, { pretty: true, title: 'a > b' });
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^<svg /);
    expect(lines[1]).toBe('  <title>a &gt; b</title>');
    expect(lines[2]).toBe('  <g>');
    expect(lines[3]).toMatch(/^ {4}<path .*\/>$/);
    expect(lines[4]).toBe('    <g>');
    expect(lines[5]).toMatch(/^ {6}<path .*\/>$/);
    expect(lines[6]).toBe('    </g>');
    expect(lines[7]).toBe('  </g>');
    expect(lines[8]).toMatch(/^ {2}<path .*\/>$/);
    expect(lines[9]).toBe('</svg>');
    expect(lines).toHaveLength(10);
  });

  it('is the compact document with whitespace added between elements only', () => {
    const compact = serializeSvg(NODES, { title: 'a > b' });
    const pretty = serializeSvg(NODES, { pretty: true, title: 'a > b' });
    expect(compact).not.toContain('\n');
    expect(pretty).toContain('\n');
    expect(pretty.replace(/\n */g, '')).toBe(compact);
  });

  it('leaves a <text> element whole, since whitespace inside it is content', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
      + '<g><text x="5" y="20" font-size="12"><tspan font-weight="700">a</tspan> b</text></g></svg>';
    const nodes = parseSvg(svg).nodes;
    const compact = serializeSvg(nodes);
    const pretty = serializeSvg(nodes, { pretty: true });
    const textOf = (s: string) => /<text[\s\S]*<\/text>/.exec(s)![0];
    expect(pretty).toContain('\n  <g>\n');
    expect(textOf(pretty)).toBe(textOf(compact));
    expect(parseSvg(pretty).nodes).toEqual(parseSvg(compact).nodes);
  });

  it('does not split on a > inside an attribute value', () => {
    const namespaces = { wd: 'https://example.test/ns' };
    const nodes: SvgNode[] = [{ ...rect(0), meta: { wd: { attrs: { note: 'a > b' } } } } as SvgNode];
    const pretty = serializeSvg(nodes, { pretty: true, namespaces });
    expect(pretty.split('\n')).toHaveLength(3);
    expect(pretty).toContain('wd:note="a > b"');
  });
});
