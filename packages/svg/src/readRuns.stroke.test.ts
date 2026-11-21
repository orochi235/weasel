import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import type { SvgTextNode } from './types';

function runsOf(body: string) {
  const warnings: string[] = [];
  const parsed = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  warnings.push(...parsed.warnings);
  return { runs: (parsed.nodes[0] as SvgTextNode).runs ?? [], warnings };
}

describe('a <tspan> stroke override', () => {
  it('keeps the inherited paint under a width of its own', () => {
    const { runs } = runsOf('<text stroke="red" stroke-width="1">a<tspan stroke-width="5">x</tspan></text>');
    expect(runs[1]?.stroke).toMatchObject({ width: 5, paint: { kind: 'solid', color: '#ff0000' } });
  });

  it('keeps the inherited paint under a dash of its own', () => {
    const { runs } = runsOf('<text stroke="red" stroke-width="2">a<tspan stroke-dasharray="3 1">x</tspan></text>');
    expect(runs[1]?.stroke).toMatchObject({ width: 2, dash: [3, 1] });
  });

  it('takes no stroke of its own from stroke="inherit" or "unset"', () => {
    for (const word of ['inherit', 'unset']) {
      const { runs, warnings } = runsOf(`<text stroke="red">a<tspan stroke="${word}">x</tspan></text>`);
      expect(runs[1]?.stroke).toBeUndefined();
      expect(warnings).toEqual([]);
    }
  });
});

describe('a run stroke that replaces a fuller node stroke', () => {
  it('reads back with none of the node\'s fields, its own spelled out at their initial values', async () => {
    const { serializeSvg } = await import('./serialize');
    const node: SvgTextNode = {
      kind: 'text', x: 0, y: 20, width: 40, height: 14, text: 'ab',
      stroke: { paint: { kind: 'solid', color: '#ff0000', opacity: 0.5 }, width: 3, cap: 'round', join: 'round', dash: [4, 2], miterLimit: 6 },
      runs: [{ text: 'a' }, { text: 'b', stroke: { paint: { kind: 'solid', color: '#0000ff' }, width: 1 } }],
    };
    const back = parseSvg(serializeSvg([node])).nodes[0] as SvgTextNode;
    expect(back.runs?.[1]?.stroke).toEqual({
      paint: { kind: 'solid', color: '#0000ff', opacity: 1 }, width: 1, cap: 'butt', join: 'miter', miterLimit: 4,
    });
  });
});

describe("a <tspan>'s user-space stroke gradient under the text's transform", () => {
  it('moves with the glyphs as the fill gradient does', () => {
    const grad = '<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="0">'
      + '<stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs>';
    const parsed = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${grad}`
      + '<text transform="translate(100 0) scale(2)">a<tspan fill="url(#g)" stroke="url(#g)">x</tspan></text></svg>');
    let n = parsed.nodes[0];
    while (n?.kind === 'group') n = n.children[0];
    const run = (n as SvgTextNode).runs![1];
    const fill = run.fill as { paint: unknown };
    expect(run.stroke?.paint).toEqual(fill.paint);
  });
});
