import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';

const box = { x: 0, y: 0, width: 100, height: 20 };

function textOf(svg: string) {
  let t: SvgNode = parseSvg(svg).nodes[0];
  while (t.kind === 'group') t = t.children[0];
  if (t.kind !== 'text') throw new Error('expected text');
  return t;
}

describe('xml:lang / lang', () => {
  it('writes a node\'s and a run\'s lang as xml:lang, and reads both back', () => {
    const node: SvgNode = {
      kind: 'text', ...box,
      text: 'ıi',
      style: { lang: 'tr' },
      runs: [{ text: 'ı' }, { text: 'i', lang: 'az' }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toMatch(/<text [^>]*xml:lang="tr"/);
    expect(svg).toContain('<tspan xml:lang="az">i</tspan>');
    const t = textOf(svg);
    expect(t.style?.lang).toBe('tr');
    expect(t.runs?.map((r) => r.lang)).toEqual([undefined, 'az']);
  });

  it('writes no lang where none is set', () => {
    const svg = serializeSvg([{ kind: 'text', ...box, text: 'hi' }], { viewBox: box });
    expect(svg).not.toContain('lang=');
    expect(textOf(svg).style?.lang).toBeUndefined();
  });

  it('inherits a lang from an ancestor, in either spelling', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" lang="tr"><g><text y="10">i</text></g></svg>`;
    expect(textOf(svg).style?.lang).toBe('tr');
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="sr"><text y="10">i</text></svg>`;
    expect(textOf(xml).style?.lang).toBe('sr');
  });

  it('lets a nearer lang win, and reads an empty one as none', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" lang="tr"><g lang="az"><text y="10">i</text></g></svg>`;
    expect(textOf(svg).style?.lang).toBe('az');
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" lang="tr"><text lang="" y="10">i</text></svg>`;
    expect(textOf(empty).style?.lang).toBeUndefined();
  });

  it('reads a tspan\'s own lang onto its run', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text y="10">a<tspan lang="tr">i</tspan></text></svg>`;
    expect(textOf(svg).runs?.map((r) => r.lang)).toEqual([undefined, 'tr']);
  });
});
