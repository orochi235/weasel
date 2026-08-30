/**
 * Unsupported-element behavior: assert that feeding an SVG with `<text>`,
 * `<clipPath>`, or other out-of-scope elements emits a warning naming
 * the element rather than throwing.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from './index';

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

  it('warns on <clipPath>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <clipPath id="clip"><rect x="0" y="0" width="5" height="5"/></clipPath>
      <rect x="0" y="0" width="10" height="10"/>
    </svg>`;
    const { warnings } = parseSvg(svg);
    expect(warnings.some((w) => /clipPath/i.test(w))).toBe(true);
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

  it('warns once for a marker key it has no entry for', () => {
    const { warnings } = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="weird"><path d="M0 0 L-3 0"/></marker></defs>' +
      '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#weird)"/></svg>',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('weird');
  });
});
