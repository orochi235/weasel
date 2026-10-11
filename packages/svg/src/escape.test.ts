import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgTextNode } from './types';

const text = (t: string, extra: Partial<SvgTextNode> = {}): SvgTextNode => ({
  kind: 'text', x: 0, y: 0, width: 10, height: 10, text: t, ...extra,
});

// XML 1.0 `Char`: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF].
const NOT_XML_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;

describe('serializeSvg and characters XML cannot hold', () => {
  it('writes no control character XML 1.0 forbids', () => {
    const all = Array.from({ length: 0x20 }, (_, i) => String.fromCharCode(i)).join('');
    const svg = serializeSvg([text(`a${all}￾￿b`)], { title: `t${all}` });
    expect(NOT_XML_CHAR.test(svg)).toBe(false);
  });

  it('reopens a document whose text held a vertical tab', () => {
    const { nodes, warnings } = parseSvg(serializeSvg([text('a\u000Bb')]));
    expect(warnings).toEqual([]);
    expect(nodes).toHaveLength(1);
    expect((nodes[0] as SvgTextNode).text).toBe('a\nb');
  });

  it('drops a lone surrogate and keeps a pair', () => {
    const svg = serializeSvg([text('a\uD83Db\u{1F600}c')]);
    expect(svg).toContain('ab\u{1F600}c');
  });

  it('writes whitespace in an attribute as character references', () => {
    const svg = serializeSvg([text('x', { style: { fontFamily: 'A\tB\nC\rD' } })]);
    expect(svg).toContain('font-family="A&#9;B&#10;C&#13;D"');
  });

  it('round-trips an attribute value holding a tab and a newline', () => {
    const { nodes } = parseSvg(serializeSvg([text('x', { style: { fontFamily: 'A\tB\nC' } })]));
    expect((nodes[0] as SvgTextNode).style?.fontFamily).toBe('A\tB\nC');
  });

  it('keeps a carriage return in text from being read back as a newline', () => {
    expect(serializeSvg([text('a\rb')])).toContain('a&#13;b');
  });

  it('escapes a color string in every paint slot', () => {
    const odd = 'a"b<c&d';
    const svg = serializeSvg([
      {
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
        fill: { kind: 'solid', color: odd },
        stroke: { paint: { kind: 'solid', color: odd }, width: 1 },
      },
      text('x', { fill: { fill: 'solid', color: odd }, runs: [{ text: 'x', fill: { fill: 'solid', color: odd } }] }),
    ]);
    expect(svg.match(/="a&quot;b&lt;c&amp;d"/g)).toHaveLength(4);
    expect(svg).not.toContain(odd);
  });
});
