import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';

describe('baseline-shift / relative font-size', () => {
  const box = { x: 0, y: 0, width: 100, height: 20 };

  it('serializes script as SVG\'s own super/sub keywords', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'h', script: 'super' }, { text: 'i', script: 'sub' }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('<tspan baseline-shift="super">h</tspan>');
    expect(svg).toContain('<tspan baseline-shift="sub">i</tspan>');
  });

  it('serializes a node-level script on <text>, and reads it back onto every run', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { script: 'sub' },
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toMatch(/<text [^>]*baseline-shift="sub"/);
    const t = parseSvg(svg).nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    // The reader has always carried a <text>-level shift down onto its runs,
    // which resolves exactly as a node-level script does.
    expect(t.runs?.every((r) => r.script === 'sub')).toBe(true);
  });

  it('serializes baselineShift as a percentage of the parent font size', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', baselineShift: 0.333 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('baseline-shift="33.3%"');
  });

  it('emits the raw baselineShift for a run that also names a script', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', script: 'super', baselineShift: 0.5 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('baseline-shift="50%"');
    expect(svg).not.toContain('baseline-shift="super"');
    // The keyword carried the preset's size too, so with the keyword gone the
    // size has to be spelled out or the run comes back full-size.
    expect(svg).toContain('font-size="58.3%"');
  });

  it('serializes fontScale as a percentage font-size, and an absolute fontSize wins', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'h', fontScale: 0.583 }, { text: 'i', fontScale: 0.583, fontSize: 12 }],
    };
    const svg = serializeSvg([node], { viewBox: box });
    expect(svg).toContain('<tspan font-size="58.3%">h</tspan>');
    expect(svg).toContain('<tspan font-size="12">i</tspan>');
  });

  it('parses baseline-shift keywords, percentages and bare ems', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="super">a</tspan><tspan baseline-shift="sub">b</tspan><tspan baseline-shift="33.3%">c</tspan><tspan baseline-shift="0.25">d</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ script: 'super' });
    expect(t.runs?.[1]).toMatchObject({ script: 'sub' });
    expect(t.runs?.[2]?.baselineShift).toBeCloseTo(0.333, 6);
    expect(t.runs?.[3]?.baselineShift).toBe(0.25);
  });

  it('keeps a run-level property named on <text> itself, with no tspan to carry it', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0" baseline-shift="super">hi</text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ text: 'hi', script: 'super' });
  });

  it('carries a <text>-level shift onto bare text either side of a tspan', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0" baseline-shift="sub">a<tspan baseline-shift="super">b</tspan>c</text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ text: 'a', script: 'sub' });
    // The tspan names its own, which wins over the inherited one.
    expect(t.runs?.[1]).toMatchObject({ text: 'b', script: 'super' });
    expect(t.runs?.[2]).toMatchObject({ text: 'c', script: 'sub' });
  });

  it('maps baseline-shift="baseline" and a zero shift to neither key', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="baseline">a</tspan><tspan baseline-shift="0">b</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.script).toBeUndefined();
    expect(t.runs?.[0]?.baselineShift).toBeUndefined();
    expect(t.runs?.[1]?.baselineShift).toBeUndefined();
  });

  it('warns on a baseline-shift unit it cannot convert but still parses the number', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan baseline-shift="4px">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.baselineShift).toBe(4);
    expect(warnings.some((w) => /baseline-shift/.test(w) && /px/.test(w))).toBe(true);
  });

  it('parses a percentage font-size to fontScale and a length to fontSize', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan font-size="58.3%">a</tspan><tspan font-size="12px">b</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.fontScale).toBeCloseTo(0.583, 6);
    expect(t.runs?.[0]?.fontSize).toBeUndefined();
    expect(t.runs?.[1]?.fontSize).toBe(12);
    expect(t.runs?.[1]?.fontScale).toBeUndefined();
  });

  it('round-trips overline, script, baselineShift and fontScale through SVG', () => {
    const runs = [
      { text: 'a', overline: true },
      { text: 'b', script: 'super' as const },
      { text: 'c', baselineShift: 0.33, fontScale: 0.6 },
      // A half-overridden preset normalizes to the two primitives it stood
      // for — not field-identical, but the same rendering, which is all SVG
      // can carry here.
      { text: 'd', script: 'sub' as const, baselineShift: 0.5 },
    ];
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'abc',
      runs,
    };
    const svg1 = serializeSvg([node], { viewBox: box });
    const parsed = parseSvg(svg1);
    expect(parsed.warnings).toEqual([]);
    const t = parsed.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.slice(0, 3)).toEqual(runs.slice(0, 3));
    expect(t.runs?.[3]).toEqual({ text: 'd', baselineShift: 0.5, fontScale: 0.583 });
    expect(serializeSvg(parsed.nodes, { viewBox: parsed.viewBox })).toBe(svg1);
  });
});
