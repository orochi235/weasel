import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';
import * as F from './__fixtures__/fixtures';
import { roundTrip } from './testing/roundTrip';

describe('round-trip', () => {
  it('plain text', () => {
    const { a, b, warnings } = roundTrip(F.TEXT_PLAIN_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('text with styled runs (tspan)', () => {
    const { a, b, warnings } = roundTrip(F.TEXT_RUNS_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('text style: font-size/family/weight/italic/align + fill round-trip', () => {
    const namespaces = { wd: 'https://weaseldraw.app/svg-ext' };
    const first = parseSvg(F.TEXT_STYLE_FULL_SVG, { namespaces });
    expect(first.warnings).toEqual([]);
    expect(first.nodes).toHaveLength(1);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.fontSize).toBe(18);
    expect(t.style?.fontFamily).toBe('Inter, sans-serif');
    expect(t.style?.fontWeight).toBe(700);
    expect(t.style?.fontStyle).toBe('italic');
    expect(t.style?.align).toBe('center');
    expect(t.fill).toEqual({ paint: { kind: 'solid', color: '#b03030' } });
    expect(t.style?.letterSpacing).toBe(1.5);
    expect(t.style?.underline).toBe(true);
    expect(t.style?.strikethrough).toBe(true);
    // lineHeight rides on meta.wd.attrs['line-height'] — interpreted by
    // svgInterop, not by weasel-svg. From weasel-svg's perspective the
    // value is just a string in the meta bag.
    expect(t.meta?.wd?.attrs?.['line-height']).toBe('1.4');

    const out = serializeSvg(first.nodes, {
      viewBox: { x: 0, y: 0, width: 200, height: 100 },
      namespaces,
    });
    expect(out).toContain('font-size="18"');
    expect(out).toContain('font-family="Inter, sans-serif"');
    expect(out).toContain('font-weight="700"');
    expect(out).toContain('font-style="italic"');
    expect(out).toContain('text-anchor="middle"');
    expect(out).toContain('wd:line-height="1.4"');
    expect(out).toContain('fill="#b03030"');
    expect(out).toContain('letter-spacing="1.5"');
    expect(out).toContain('text-decoration="underline line-through"');
    // Legacy attribute is gone — no compat-write either.
    expect(out).not.toContain('data-weasel-line-height');

    const second = parseSvg(out, { namespaces });
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.style).toEqual(t.style);
    expect(t2.meta?.wd?.attrs?.['line-height']).toBe('1.4');
  });

  /**
   * Text strokes used to be dropped on parse with a warning, because the
   * renderer had nothing to stroke — an SDF glyph is a sampled field, not
   * geometry. The outline tier changed that, so they now round-trip like any
   * other paint.
   */
  it('text stroke: node-level and per-run, with joins/caps/dashes', () => {
    const first = parseSvg(F.TEXT_STROKE_SVG);
    expect(first.warnings).toEqual([]);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');

    expect(t.stroke).toEqual({
      paint: { kind: 'solid', color: '#c0392b' },
      width: 3,
      join: 'round',
      cap: 'round',
      miterLimit: 6,
      dash: [4, 2],
    });
    // The run overrides colour and width and inherits nothing else — a run's
    // stroke replaces the node's rather than merging with it.
    expect(t.runs?.[1].stroke).toEqual({
      paint: { kind: 'solid', color: '#1e90ff' },
      width: 1.5,
    });

    const out = serializeSvg(first.nodes, { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).toContain('stroke="#c0392b"');
    expect(out).toContain('stroke-width="3"');
    expect(out).toContain('stroke-linejoin="round"');
    expect(out).toContain('stroke-linecap="round"');
    expect(out).toContain('stroke-miterlimit="6"');
    expect(out).toContain('stroke-dasharray="4 2"');
    expect(out).toContain('stroke="#1e90ff"');

    const second = parseSvg(out);
    const t2 = second.nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.stroke).toEqual(t.stroke);
    expect(t2.runs?.[1].stroke).toEqual(t.runs?.[1].stroke);
  });

  it('a gradient-stroked text node gets its gradient into <defs>', () => {
    // `<defs>` is written before the body, so a paint first seen while
    // emitting an element would reference an id nothing defines.
    const node: SvgNode = {
      kind: 'text',
      x: 0, y: 0, width: 100, height: 40,
      text: 'grad',
      stroke: {
        paint: {
          kind: 'linear-gradient',
          from: { x: 0, y: 0 },
          to: { x: 1, y: 0 },
          stops: [
            { offset: 0, color: '#ff0000' },
            { offset: 1, color: '#0000ff' },
          ],
        },
        width: 2,
      },
    };
    const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 100, height: 40 } });
    const ref = /stroke="url\(#([^)]+)\)"/.exec(out);
    expect(ref).not.toBeNull();
    expect(out).toContain(`id="${ref![1]}"`);
  });

  it('text fill="none" survives as an explicit no-fill, not as black', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">'
      + '<text x="10" y="20" fill="none" stroke="#c0392b" stroke-width="3"'
      + ' data-weasel-width="180" data-weasel-height="40">Outline</text></svg>';
    const first = parseSvg(svg);
    const t = first.nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    // Absent would mean the default black — the one thing outline-only text
    // must not resolve to.
    expect(t.fill).toBeNull();

    const out = serializeSvg(first.nodes, { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).toContain('fill="none"');
    const t2 = parseSvg(out).nodes[0];
    if (t2.kind !== 'text') throw new Error('expected text');
    expect(t2.fill).toBeNull();
  });

  it('text wrap survives, and is absent when the style does not declare it', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">'
      + '<text x="10" y="20" data-weasel-width="60" data-weasel-height="40"'
      + ' data-weasel-wrap="true">Wrapped text</text></svg>';
    const t = parseSvg(svg).nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.wrap).toBe(true);
    const out = serializeSvg([t], { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).toContain('data-weasel-wrap="true"');

    const plain = parseSvg(F.TEXT_PLAIN_SVG).nodes[0];
    if (plain.kind !== 'text') throw new Error('expected text');
    expect(plain.style?.wrap).toBeUndefined();
    expect(serializeSvg([plain], { viewBox: { x: 0, y: 0, width: 200, height: 100 } }))
      .not.toContain('data-weasel-wrap');
  });

  it('justified text anchors at its start edge and reads back as justified', () => {
    const base = parseSvg(F.TEXT_PLAIN_SVG).nodes[0];
    if (base.kind !== 'text') throw new Error('expected text');
    for (const direction of ['ltr', 'rtl'] as const) {
      const node: SvgNode = {
        ...base, x: 10, width: 180, style: { ...base.style, align: 'justify', direction, wrap: true },
      };
      const out = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
      // Every line SVG draws closes its paragraph, so `start` is all of it.
      expect(out).not.toContain('text-anchor=');
      expect(out).toContain(`x="${direction === 'ltr' ? 10 : 190}"`);
      expect(out).toContain('data-weasel-align="justify"');
      const back = parseSvg(out).nodes[0];
      if (back.kind !== 'text') throw new Error('expected text');
      expect(back.style?.align).toBe('justify');
      expect(back.style?.direction ?? 'ltr').toBe(direction);
      expect(back.x).toBeCloseTo(10);
    }
  });

  it('unstroked text emits no stroke attribute at all', () => {
    const first = parseSvg(F.TEXT_PLAIN_SVG);
    const out = serializeSvg(first.nodes, { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).not.toContain('stroke=');
  });

  /**
   * A panel that writes one stroke field onto a node with no stroke used to
   * leave a whole stroke behind with no `paint`. The painters read that as no
   * stroke; the serializer dereferenced it and took the export down with it.
   */
  it('a stroke carrying no paint serializes as no stroke', () => {
    const node = parseSvg(F.TEXT_PLAIN_SVG).nodes[0];
    if (node.kind !== 'text') throw new Error('expected a text node');
    const unpainted: SvgNode = { ...node, stroke: { width: 2, cap: 'round' } };
    const out = serializeSvg([unpainted], { viewBox: { x: 0, y: 0, width: 200, height: 100 } });
    expect(out).not.toContain('stroke=');
    expect(out).not.toContain('stroke-width=');
  });
});
