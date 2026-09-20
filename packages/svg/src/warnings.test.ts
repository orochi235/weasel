/**
 * Unsupported-element behavior: assert that feeding an SVG with `<text>`,
 * `<clipPath>`, or other out-of-scope elements emits a warning naming
 * the element rather than throwing.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode, type SvgStroke, type SvgTextNode } from './index';

describe('warnings', () => {
  it('parses <text> into a text node', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="10" height="10"/>
      <text x="0" y="20">hello</text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(nodes).toHaveLength(2);
    expect(nodes[1].kind).toBe('text');
    expect(warnings).toEqual([]);
  });

  it('reads a <clipPath> without warning', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <clipPath id="clip"><rect x="0" y="0" width="5" height="5"/></clipPath>
      <rect x="0" y="0" width="10" height="10"/>
    </svg>`;
    const { warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
  });

  it('warns on a multi-shape <clipPath>, and clips nothing', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <clipPath id="clip">
        <rect x="0" y="0" width="5" height="5"/>
        <rect x="6" y="0" width="5" height="5"/>
      </clipPath>
      <g clip-path="url(#clip)"><rect x="0" y="0" width="10" height="10"/></g>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings.some((w) => /single-shape clip/.test(w))).toBe(true);
    expect((nodes[0] as { clip?: unknown }).clip).toBeUndefined();
  });

  it('warns on a clip-path pointing at nothing', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#absent)"><rect x="0" y="0" width="10" height="10"/></g>
    </svg>`;
    const { warnings } = parseSvg(svg);
    expect(warnings.some((w) => /no <clipPath>/.test(w))).toBe(true);
  });

  it('warns on <filter>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <filter id="f"/>
      <rect x="0" y="0" width="10" height="10"/>
    </svg>`;
    const { warnings } = parseSvg(svg);
    expect(warnings.some((w) => /filter/i.test(w))).toBe(true);
  });

  it('does not throw on multiple unsupported siblings', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <use href="#x"/>
      <mask id="m"/>
      <foreignObject/>
    </svg>`;
    expect(() => parseSvg(svg)).not.toThrow();
    const { warnings } = parseSvg(svg);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts a <marker> def for a known key without warning', () => {
    const { warnings } = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="arrow"><path d="M0 0 L-3 0"/></marker></defs>' +
      '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#arrow)"/></svg>',
    );
    expect(warnings).toEqual([]);
  });

  it('reads a document marker the kit has no key for without a warning', () => {
    const { warnings, markers } = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="weird"><path d="M0 0 L-3 0"/></marker></defs>' +
      '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#weird)"/></svg>',
    );
    expect(warnings).toEqual([]);
    expect(markers).toHaveLength(1);
  });

  it('warns once for a marker neither the kit nor the document defines', () => {
    const { warnings } = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#weird)"/></svg>',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('weird');
  });
});

describe('serializeSvg says what SVG 1.1 cannot carry', () => {
  const warningsFor = (nodes: SvgNode[]): string[] => {
    const out: string[] = [];
    serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 100, height: 100 }, onWarn: (m) => out.push(m) });
    return out;
  };
  const text = (extra: Partial<SvgTextNode> = {}): SvgNode => ({
    kind: 'text', x: 0, y: 0, width: 50, height: 40, text: 'hi', ...extra,
  });
  const rect = (stroke: SvgStroke): SvgNode => ({
    kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { kind: 'none' }, stroke,
  });
  const black = { fill: 'solid' as const, color: '#000000' };

  it('warns once for a path stroke aligned off its edge, however many share it', () => {
    const stroke: SvgStroke = { paint: { kind: 'solid', color: '#000' }, width: 2, align: 'inner' };
    const w = warningsFor([rect(stroke), rect(stroke)]);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('inner');
  });

  it('warns for a text stroke, or a run stroke, aligned off its edge', () => {
    expect(warningsFor([text({ stroke: { paint: black, width: 1, align: 'outer' } })])[0])
      .toContain('outer');
    expect(warningsFor([text({
      text: 'hi', runs: [{ text: 'hi', stroke: { paint: black, width: 1, align: 'inner' } }],
    })])[0]).toContain('inner');
  });

  it('warns for wrapped and vertically aligned text', () => {
    expect(warningsFor([text({ style: { wrap: true } })]).join(' ')).toMatch(/wrap/);
    expect(warningsFor([text({ verticalAlign: 'bottom' })]).join(' ')).toMatch(/bottom/);
  });

  it('stays quiet for what SVG does carry', () => {
    expect(warningsFor([
      rect({ paint: { kind: 'solid', color: '#000' }, width: 2, align: 'center' }),
      rect({ paint: { kind: 'solid', color: '#000' }, width: 2 }),
      text({ stroke: { paint: black, width: 1 }, verticalAlign: 'top', style: { wrap: false } }),
    ])).toEqual([]);
  });
});
