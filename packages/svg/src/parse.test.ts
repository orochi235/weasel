/**
 * Targeted tests for paint cascade behavior in `readPaint` / `readStroke`:
 *
 *  - Parent <g fill="..."> values inherit down to leaf <path>/etc.
 *  - `style="fill:..."` is honored AND beats the presentation `fill="..."`
 *    attribute on the same element, per SVG2 cascade rules.
 *  - The `inherit` keyword forces a walk past the current element to the
 *    closest ancestor that DOES set the property.
 *  - Stroke-related attrs (stroke, stroke-width, fill-opacity,
 *    stroke-opacity, stroke-linecap, etc.) inherit too.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from './index';
import type { SvgPathNode } from './types';

function firstPath(svg: string): SvgPathNode {
  const { nodes } = parseSvg(svg);
  // Drill into the first leaf (groups wrap things; we want the path).
  function find(ns: typeof nodes): SvgPathNode {
    for (const n of ns) {
      if (n.kind === 'path') return n;
      if (n.kind === 'group') {
        const inner = find(n.children);
        if (inner) return inner;
      }
    }
    throw new Error('no path leaf found');
  }
  return find(nodes);
}

describe('paint inheritance', () => {
  it('inherits fill from parent <g>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000"><path d="M0,0 L1,0 L1,1 Z"/></g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it("path's own fill wins over parent <g>", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000"><path d="M0,0 L1,0 L1,1 Z" fill="#00ff00"/></g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });

  it('closest ancestor wins when groups nest', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000">
        <g fill="#00ff00">
          <path d="M0,0 L1,0 L1,1 Z"/>
        </g>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });

  it('honors fill from style="fill:..."', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L1,0 L1,1 Z" style="fill:#ff0000"/>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('style fill beats presentation attribute on the same element (SVG2)', () => {
    // SVG2 cascade: presentation attrs have specificity zero; style attr
    // is a CSS rule and wins. Verified against
    // https://www.w3.org/TR/SVG2/styling.html#PresentationAttributes
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L1,0 L1,1 Z" fill="#00ff00" style="fill:#ff0000"/>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('"inherit" keyword on inner group walks past it to grandparent', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000">
        <g fill="inherit">
          <path d="M0,0 L1,0 L1,1 Z"/>
        </g>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('falls back to default black when no ancestor sets fill', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g><path d="M0,0 L1,0 L1,1 Z"/></g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#000000' });
  });

  it('inherits style-fill from parent <g style="fill:...">', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g style="fill:#ff0000"><path d="M0,0 L1,0 L1,1 Z"/></g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('reads fill-opacity from style and from ancestor', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g fill="#ff0000" fill-opacity="0.5">
        <path d="M0,0 L1,0 L1,1 Z"/>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.fill).toMatchObject({ kind: 'solid', color: '#ff0000', opacity: 0.5 });
  });
});

describe('stroke inheritance', () => {
  it('inherits stroke from parent <g>', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g stroke="#ff0000" stroke-width="2">
        <path d="M0,0 L1,0"/>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke).toBeDefined();
    expect(path.stroke?.paint).toEqual({ kind: 'solid', color: '#ff0000' });
    expect(path.stroke?.width).toBe(2);
  });

  it("path's own stroke wins over parent <g>", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g stroke="#ff0000"><path d="M0,0 L1,0" stroke="#00ff00"/></g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke?.paint).toEqual({ kind: 'solid', color: '#00ff00' });
  });

  it('honors stroke from style="stroke:..."', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L1,0" style="stroke:#ff0000;stroke-width:3"/>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke?.paint).toEqual({ kind: 'solid', color: '#ff0000' });
    expect(path.stroke?.width).toBe(3);
  });

  it('style stroke beats presentation attribute (SVG2)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L1,0" stroke="#00ff00" style="stroke:#ff0000"/>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke?.paint).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('inherits stroke-linecap, stroke-linejoin from ancestor', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g stroke="#000000" stroke-linecap="round" stroke-linejoin="bevel">
        <path d="M0,0 L1,0"/>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke?.cap).toBe('round');
    expect(path.stroke?.join).toBe('bevel');
  });

  it('inherits stroke-opacity from ancestor', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g stroke="#ff0000" stroke-opacity="0.25">
        <path d="M0,0 L1,0"/>
      </g>
    </svg>`;
    const path = firstPath(svg);
    expect(path.stroke?.opacity).toBeCloseTo(0.25);
  });
});

describe('Ghostscript-tiger-style fixture', () => {
  it('path inside <g fill="..."> ends up with the group fill, not default black', () => {
    // Minimal recreation of the GS tiger pattern: many groups, each
    // declaring a fill, with leaf paths carrying only `d=`.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g fill="#ffb300" stroke="#000000" stroke-width="0.5">
        <path d="M10,10 L20,10 L20,20 Z"/>
        <path d="M30,30 L40,30 L40,40 Z"/>
      </g>
      <g fill="#0066cc">
        <path d="M50,50 L60,50 L60,60 Z"/>
      </g>
    </svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    // Two top-level groups.
    expect(nodes).toHaveLength(2);
    const g0 = nodes[0];
    const g1 = nodes[1];
    if (g0.kind !== 'group' || g1.kind !== 'group') throw new Error('expected groups');
    expect(g0.children).toHaveLength(2);
    for (const child of g0.children) {
      if (child.kind !== 'path') continue;
      expect(child.fill).toEqual({ kind: 'solid', color: '#ffb300' });
      expect(child.stroke?.paint).toEqual({ kind: 'solid', color: '#000000' });
      expect(child.stroke?.width).toBe(0.5);
    }
    const inner = g1.children[0];
    if (inner.kind !== 'path') throw new Error('expected path');
    expect(inner.fill).toEqual({ kind: 'solid', color: '#0066cc' });
  });
});
