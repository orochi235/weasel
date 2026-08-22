import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgTextNode } from './types';

const SVG = 'http://www.w3.org/2000/svg';

function viewBoxOf(svg: string): number[] {
  return (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? '').split(' ').map(Number);
}

describe('<text> whitespace', () => {
  it('collapses the indentation of a pretty-printed <text>', () => {
    const r = parseSvg(
      `<svg xmlns="${SVG}"><text x="0" y="0">\n`
      + `  <tspan font-weight="700">Hello</tspan>\n`
      + `  <tspan>world</tspan>\n`
      + `</text></svg>`,
    );
    const node = r.nodes[0] as SvgTextNode;
    expect(node.text).toBe('Hello world');
    expect(node.runs?.map((run) => run.text)).toEqual(['Hello', ' ', 'world']);
  });

  it('does not report a one-line label as four lines tall', () => {
    const r = parseSvg(`<svg xmlns="${SVG}"><text x="0" y="0" font-size="10">\n  Hi\n</text></svg>`);
    expect((r.nodes[0] as SvgTextNode).height).toBeCloseTo(12);
  });

  it('keeps line breaks under xml:space="preserve"', () => {
    const r = parseSvg(`<svg xmlns="${SVG}"><text x="0" y="0" xml:space="preserve">a\nb</text></svg>`);
    expect((r.nodes[0] as SvgTextNode).text).toBe('a\nb');
  });

  it('round-trips multi-line weasel text', () => {
    const nodes: SvgNode[] = [{
      kind: 'text', x: 0, y: 0, width: 100, height: 40, text: 'one\ntwo',
    }];
    const back = parseSvg(serializeSvg(nodes)).nodes[0] as SvgTextNode;
    expect(back.text).toBe('one\ntwo');
  });
});

describe('nested <svg>', () => {
  it('offsets children by the nested viewport origin', () => {
    const r = parseSvg(
      `<svg xmlns="${SVG}" viewBox="0 0 100 100">`
      + `<svg x="50" y="20"><rect width="10" height="10"/></svg></svg>`,
    );
    expect((r.nodes[0] as { path: unknown }).path).toEqual({
      kind: 'rect', x: 50, y: 20, width: 10, height: 10,
    });
  });

  it('warns that a nested viewBox is not rescaled', () => {
    const r = parseSvg(
      `<svg xmlns="${SVG}"><svg viewBox="0 0 10 10" width="5" height="5">`
      + `<rect width="10" height="10"/></svg></svg>`,
    );
    expect(r.warnings.join('\n')).toMatch(/nested <svg> viewBox/);
  });
});

describe('root attributes', () => {
  it('warns when width carries a unit it cannot convert', () => {
    const r = parseSvg(`<svg xmlns="${SVG}" width="100mm" height="50%" viewBox="0 0 10 10"/>`);
    expect(r.width).toBe(100);
    expect(r.warnings.join('\n')).toMatch(/width="100mm"/);
    expect(r.warnings.join('\n')).toMatch(/height="50%"/);
  });

  it('reads opacity from style=""', () => {
    const r = parseSvg(`<svg xmlns="${SVG}"><rect width="10" height="10" style="opacity:0.5"/></svg>`);
    expect((r.nodes[0] as { opacity?: number }).opacity).toBe(0.5);
  });
});

describe('computed viewBox', () => {
  it('covers a rotated leaf', () => {
    const nodes: SvgNode[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 100, height: 10 },
      fill: { kind: 'solid', color: '#000000' },
      rotation: Math.PI / 2,
    }];
    expect(viewBoxOf(serializeSvg(nodes))).toEqual([45, -45, 10, 100]);
  });

  it('covers a transformed group', () => {
    const nodes: SvgNode[] = [{
      kind: 'group',
      transform: [1, 0, 0, 1, 200, 0],
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
        fill: { kind: 'solid', color: '#000000' },
      }],
    }];
    expect(viewBoxOf(serializeSvg(nodes))).toEqual([200, 0, 10, 10]);
  });
});
