import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';

describe('letter-spacing / text-decoration', () => {
  it('serializes a run with letterSpacing + underline to letter-spacing="2" text-decoration="underline"', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', letterSpacing: 2, underline: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('letter-spacing="2"');
    expect(svg).toContain('text-decoration="underline"');
  });

  it('keeps a text\'s tab size through a round trip', () => {
    const node = {
      id: 't1', kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'a\tb', style: { tabSize: 4 },
    } as unknown as SvgNode;
    const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    const back = parseSvg(out).nodes[0];
    if (back.kind !== 'text') throw new Error('expected text');
    expect(back.style?.tabSize).toBe(4);
    expect(back.text).toBe('a\tb');
  });

  it('writes an unfilled run as fill="none" and reads it back', () => {
    const node = {
      id: 't1', kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'ab',
      runs: [{ text: 'a', fill: null }, { text: 'b' }],
      fill: { kind: 'solid', color: '#ff0000' },
    } as unknown as SvgNode;
    const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).toContain('<tspan fill="none">a</tspan>');
    const back = parseSvg(out).nodes[0];
    if (back.kind !== 'text') throw new Error('expected text');
    expect(back.runs?.[0]).toEqual({ text: 'a', fill: null });
    expect(back.runs?.[1]).toEqual({ text: 'b' });
  });

  it('parses a <tspan> letter-spacing + text-decoration="underline" back to run keys', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="2" text-decoration="underline">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ letterSpacing: 2, underline: true });
  });

  it('emits both flags as a space-separated list when a run has underline and strikethrough', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      runs: [{ text: 'hi', underline: true, strikethrough: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('text-decoration="underline line-through"');
  });

  it('round-trips text-decoration="underline line-through" on a <tspan> to both flags', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="underline line-through">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]).toMatchObject({ underline: true, strikethrough: true });
  });

  it('text-decoration="none" maps to neither flag', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="none">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBeUndefined();
    expect(t.runs?.[0]?.strikethrough).toBeUndefined();
  });

  it('an unrecognized text-decoration token (e.g. blink) is dropped without crashing', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="blink">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBeUndefined();
    expect(t.runs?.[0]?.strikethrough).toBeUndefined();
    expect(t.runs?.[0]?.overline).toBeUndefined();
  });

  it('serializes overline on a run and on the node style', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { overline: true },
      runs: [{ text: 'hi', underline: true, overline: true }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('<text ');
    expect(svg).toContain('text-decoration="overline"');
    expect(svg).toContain('<tspan text-decoration="underline overline">hi</tspan>');
  });

  it('parses text-decoration="overline" to the overline flag at both levels', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0" text-decoration="overline"><tspan text-decoration="line-through overline">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.overline).toBe(true);
    expect(t.runs?.[0]).toMatchObject({ strikethrough: true, overline: true });
  });

  it('round-trips a run weight, reading 700 back as the bold flag it renders as', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'abcd',
      style: { fontWeight: 700 },
      runs: [
        { text: 'a', fontWeight: 300 },
        { text: 'b', fontWeight: 400 },
        { text: 'c', bold: true },
        { text: 'd', fontWeight: 900 },
      ],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('<tspan font-weight="300">a</tspan>');
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs).toEqual(node.runs);
    const normal = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><text font-weight="bold"><tspan font-weight="normal">x</tspan></text></svg>');
    const n = normal.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.runs).toEqual([{ text: 'x', fontWeight: 400 }]);
  });

  it('writes textTransform as a CSS style property on the text and its tspans', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'ab',
      style: { textTransform: 'uppercase' },
      runs: [{ text: 'a', textTransform: 'none' }, { text: 'b', bold: true, textTransform: 'capitalize' }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toMatch(/<text [^>]*style="text-transform:uppercase"/);
    expect(svg).toContain('<tspan style="text-transform:none">a</tspan>');
    expect(svg).toContain('<tspan font-weight="700" style="text-transform:capitalize">b</tspan>');
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.textTransform).toBe('uppercase');
    expect(t.runs).toEqual(node.runs);
  });

  it('reads text-transform from an attribute or an ancestor, and ignores an unknown value', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <g style="text-transform: lowercase"><text x="0" y="0">A<tspan text-transform="full-width">b</tspan></text></g>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const g = nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    const t = g.children[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.textTransform).toBe('lowercase');
    expect(t.runs?.[1]?.textTransform).toBeUndefined();
  });

  it('writes fontVariantCaps as font-variant on the text and its tspans, and reads it back', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'ab',
      style: { fontVariantCaps: 'small-caps' },
      runs: [{ text: 'a', fontVariantCaps: 'normal' }, { text: 'b', fontVariantCaps: 'small-caps' }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toMatch(/<text [^>]*font-variant="small-caps"/);
    expect(svg).toContain('<tspan font-variant="normal">a</tspan>');
    expect(svg).toContain('<tspan font-variant="small-caps">b</tspan>');
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.fontVariantCaps).toBe('small-caps');
    expect(t.runs).toEqual(node.runs);
  });

  it('reads font-variant from a style or an ancestor, and warns on a value it does not model', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <g style="font-variant: small-caps"><text x="0" y="0">A<tspan font-variant="all-small-caps">b</tspan></text></g>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    const g = nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    const t = g.children[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.fontVariantCaps).toBe('small-caps');
    expect(t.runs?.[1]?.fontVariantCaps).toBeUndefined();
    expect(warnings.some((w) => w.includes('all-small-caps'))).toBe(true);
  });

  it('accepts letter-spacing with a unit suffix and drops the "normal" keyword', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="2px">a</tspan><tspan letter-spacing="normal">b</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.letterSpacing).toBe(2);
    expect(t.runs?.[1]?.letterSpacing).toBeUndefined();
  });

  it('omits node-level letterSpacing when it is 0 (the default)', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { letterSpacing: 0 },
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).not.toContain('letter-spacing');
  });

  it('emits run-level letterSpacing even when it is 0 — a real override, not "unset"', () => {
    // Per the runs model's additive-flags contract (rangeStyle.ts), a run
    // storing `letterSpacing: 0` is deliberately distinct from a run that
    // doesn't mention letterSpacing at all (which inherits the node's
    // value). Dropping it on serialize would silently turn the override
    // into an inherit, changing what the document renders.
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'hi',
      style: { letterSpacing: 4 },
      runs: [{ text: 'hi', letterSpacing: 0 }],
    };
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    expect(svg).toContain('letter-spacing="4"');
    expect(svg).toContain('<tspan letter-spacing="0">hi</tspan>');
  });

  it('is idempotent when a run overrides the node letterSpacing down to 0', () => {
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 20,
      text: 'AB',
      style: { letterSpacing: 4 },
      runs: [{ text: 'A' }, { text: 'B', letterSpacing: 0 }],
    };
    const svg1 = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 20 } });
    const parsed = parseSvg(svg1);
    const t = parsed.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.letterSpacing).toBe(4);
    // The override must survive as an explicit 0, not fall back to
    // "unset → inherits 4".
    expect(t.runs?.[1]?.letterSpacing).toBe(0);
    const svg2 = serializeSvg(parsed.nodes, { viewBox: parsed.viewBox });
    expect(svg2).toBe(svg1);
  });

  it('a run with only strikethrough (no other override) still attaches node.runs', () => {
    // hasStyling in parseTextElement decides whether the run array survives
    // parse at all — every other test here happens to set `underline`
    // alongside `strikethrough`, which would mask a hasStyling regression
    // that only checked one of the two flags.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="line-through">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs).toBeDefined();
    expect(t.runs?.[0]).toMatchObject({ strikethrough: true });
    expect(t.runs?.[0]?.underline).toBeUndefined();
  });

  it('warns on a letter-spacing unit it cannot convert (e.g. vw) but still parses the numeric value', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan letter-spacing="0.1vw">hi</tspan></text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.letterSpacing).toBe(0.1);
    expect(warnings.some((w) => /letter-spacing/.test(w) && /vw/.test(w))).toBe(true);
  });

  it('matches text-decoration tokens case-insensitively', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="0"><tspan text-decoration="UNDERLINE">hi</tspan></text>
    </svg>`;
    const { nodes } = parseSvg(svg);
    const t = nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.runs?.[0]?.underline).toBe(true);
  });
});
