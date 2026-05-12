/**
 * Unsupported-element behavior: assert that feeding an SVG with `<text>`,
 * `<clipPath>`, or other out-of-scope elements emits a warning naming
 * the element rather than throwing.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from './index';

describe('warnings', () => {
  it('warns on <text>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="10" height="10"/>
      <text x="0" y="20">hello</text>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(nodes).toHaveLength(1);
    expect(warnings.some((w) => /text/i.test(w))).toBe(true);
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
      <text>a</text>
      <foreignObject/>
    </svg>`;
    expect(() => parseSvg(svg)).not.toThrow();
    const { warnings } = parseSvg(svg);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});
