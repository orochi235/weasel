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
import type { SvgPathNode, SvgTextNode } from './types';

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

describe('currentColor', () => {
  it('resolves fill="currentColor" against an inherited color', () => {
    const p = firstPath('<svg><g color="#00ff00"><rect width="4" height="4" fill="currentColor"/></g></svg>');
    expect(p.fill).toMatchObject({ color: '#00ff00' });
  });

  it('defaults currentColor to black when color is unset', () => {
    const p = firstPath('<svg><rect width="4" height="4" fill="currentColor"/></svg>');
    expect(p.fill).toMatchObject({ color: '#000000' });
  });

  it('resolves stroke="currentColor" against an inherited color', () => {
    const p = firstPath('<svg><g color="#0000ff"><rect width="4" height="4" stroke="currentColor" stroke-width="2"/></g></svg>');
    expect(p.stroke?.paint).toMatchObject({ color: '#0000ff' });
  });
});

function firstText(svg: string): SvgTextNode {
  const { nodes } = parseSvg(svg);
  const walk = (ns: typeof nodes): SvgTextNode | null => {
    for (const n of ns) {
      if (n.kind === 'text') return n;
      if (n.kind === 'group') {
        const t = walk(n.children);
        if (t) return t;
      }
    }
    return null;
  };
  const t = walk(nodes);
  if (!t) throw new Error('no <text> node produced');
  return t;
}

describe('text cascade', () => {
  it('inherits fill from an ancestor <g>', () => {
    const t = firstText('<svg><g fill="#ff0000"><text x="0" y="10">hi</text></g></svg>');
    expect(t.fill).toMatchObject({ color: '#ff0000' });
  });

  it('inherits font-family from an ancestor <g>', () => {
    const t = firstText('<svg><g font-family="Georgia"><text x="0" y="10">hi</text></g></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
  });

  it('honors style="" on the text element', () => {
    const t = firstText('<svg><text x="0" y="10" style="font-family:Georgia">hi</text></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
  });

  it('a <tspan> inherits the base font from an ancestor <g> via the text style', () => {
    const t = firstText('<svg><g font-family="Georgia"><text x="0" y="10"><tspan>a</tspan></text></g></svg>');
    expect(t.style?.fontFamily).toBe('Georgia');
    // The run carries no redundant fontFamily override — the base style holds it.
    expect(t.runs).toBeUndefined();
  });

  it('resolves text fill="currentColor" against inherited color', () => {
    const t = firstText('<svg><g color="#00ff00"><text x="0" y="10" fill="currentColor">hi</text></g></svg>');
    expect(t.fill).toMatchObject({ color: '#00ff00' });
  });

  it('resolves <tspan fill="currentColor"> against inherited color', () => {
    const t = firstText('<svg><g color="#00ff00"><text x="0" y="10"><tspan fill="currentColor">a</tspan></text></g></svg>');
    expect(t.runs?.[0]?.fill).toMatchObject({ color: '#00ff00' });
  });
});

describe('<style> stylesheets', () => {
  it('resolves an Illustrator-style export: class rules in <defs><style>', () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <style>
      .cls-1 {
        fill: #f00;
      }

      .cls-2 {
        fill: none;
        stroke: #231f20;
        stroke-miterlimit: 10;
        stroke-width: 2px;
      }
    </style>
  </defs>
  <rect class="cls-1" x="10" y="10" width="30" height="30"/>
  <circle class="cls-2" cx="70" cy="70" r="20"/>
</svg>`;
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    const [rect, circle] = nodes as SvgPathNode[];
    expect(rect.fill).toEqual({ kind: 'solid', color: '#ff0000' });
    expect(circle.fill).toEqual({ kind: 'none' });
    expect(circle.stroke?.paint).toEqual({ kind: 'solid', color: '#231f20' });
    expect(circle.stroke?.width).toBe(2);
  });

  it('a top-level <style> is not reported as an unsupported element', () => {
    const { warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <style><![CDATA[ rect { fill: #0f0 } ]]></style><rect width="1" height="1"/>
    </svg>`);
    expect(warnings).toEqual([]);
  });

  it('a class rule on a <tspan> styles that run', () => {
    const t = firstText(`<svg xmlns="http://www.w3.org/2000/svg">
      <style>.hot { fill: #f00 }</style>
      <text x="0" y="10">a<tspan class="hot">b</tspan></text>
    </svg>`);
    expect(t.runs?.find((r) => r.fill)?.fill).toMatchObject({ color: '#ff0000' });
  });
});

describe('conditional at-rules', () => {
  const fillWith = (css: string, opts: Parameters<typeof parseSvg>[1], attrs = 'width="800" height="600"'): unknown =>
    (parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><style>${css}</style><rect width="1" height="1"/></svg>`, opts)
      .nodes[0] as SvgPathNode).fill;
  const fillOf = (css: string, attrs?: string): unknown => fillWith(css, {}, attrs);
  const RED = { kind: 'solid', color: '#ff0000' };
  const BLACK = { kind: 'solid', color: '#000000' };

  it('applies a rule inside a matching @media', () => {
    expect(fillOf('@media screen { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@media all and (min-width: 500px) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@media (orientation: landscape) { rect { fill: red } }')).toEqual(RED);
  });
  it('skips a rule inside a non-matching @media', () => {
    expect(fillOf('@media print { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@media (min-width: 900px) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@media (prefers-color-scheme: dark) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@media (hover: hover) { rect { fill: red } }')).toEqual(BLACK);
  });
  it('takes the viewport from the viewBox when the root has no size', () => {
    expect(fillOf('@media (width: 40px) { rect { fill: red } }', 'viewBox="0 0 40 20"')).toEqual(RED);
  });
  it('evaluates against the media option', () => {
    const css = '@media (prefers-color-scheme: dark) { rect { fill: red } }';
    expect(fillWith(css, { media: { prefersColorScheme: 'dark' } })).toEqual(RED);
    expect(fillWith('@media print { rect { fill: red } }', { media: { type: 'print' } })).toEqual(RED);
    expect(fillWith('@media (min-width: 1000px) { rect { fill: red } }', { media: { width: 1200 } })).toEqual(RED);
  });
  it('applies a rule inside a @supports the parser honors', () => {
    expect(fillOf('@supports (fill: red) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@supports not (display: grid) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@supports (display: grid) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@supports selector(rect > g) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@supports selector(rect >>> g) { rect { fill: red } }')).toEqual(BLACK);
  });
  it('nests conditional at-rules', () => {
    expect(fillOf('@media screen { @supports (fill: red) { @media (width > 10px) { rect { fill: red } } } }'))
      .toEqual(RED);
    expect(fillOf('@media screen { @supports (display: grid) { rect { fill: red } } }')).toEqual(BLACK);
    expect(fillOf('@media print { @supports (fill: red) { rect { fill: red } } }')).toEqual(BLACK);
  });
  it('keeps source order across at-rule boundaries', () => {
    expect(fillOf('@media screen { rect { fill: red } } rect { fill: blue }'))
      .toEqual({ kind: 'solid', color: '#0000ff' });
    expect(fillOf('rect { fill: blue } @media screen { rect { fill: red } }')).toEqual(RED);
  });
  it('still skips other block at-rules, and resumes after them', () => {
    expect(fillOf('@font-face { font-family: X } @keyframes k { from { fill: blue } } rect { fill: red }')).toEqual(RED);
    expect(fillOf('@container (min-width: 1px) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@container (min-width: 1px) { rect { fill: blue } } rect { fill: red }')).toEqual(RED);
  });
  it('applies rules inside @layer, below unlayered ones', () => {
    expect(fillOf('@layer base { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('rect { fill: red } @layer base { rect { fill: blue } }')).toEqual(RED);
  });
  it('routes <style media> through the same evaluator', () => {
    const svg = (media: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <style media="${media}">rect { fill: red }</style><rect width="1" height="1"/></svg>`;
    const fill = (media: string, opts = {}): unknown => (parseSvg(svg(media), opts).nodes[0] as SvgPathNode).fill;
    expect(fill('screen and (min-width: 500px)')).toEqual(RED);
    expect(fill('(min-width: 900px)')).toEqual(BLACK);
    expect(fill('print')).toEqual(BLACK);
    expect(fill('print', { media: { type: 'print' } })).toEqual(RED);
    expect(fill('not print')).toEqual(RED);
  });
  it('reports each @import, which is not fetched', () => {
    const { warnings } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <style>@import url("theme.css") screen; @media screen { @import "late.css"; } rect { fill: red }</style>
      <rect width="1" height="1"/></svg>`);
    expect(warnings).toEqual(['@import url("theme.css") screen is not fetched; its rules do not apply']);
  });
});

describe('values read through the property table', () => {
  const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
  it('reads a percentage opacity as a ratio', () => {
    const p = parse('<rect width="1" height="1" opacity="50%" fill-opacity="25%"/>').nodes[0] as SvgPathNode;
    expect(p.opacity).toBe(0.5);
    expect(p.fill).toMatchObject({ opacity: 0.25 });
  });
  it('resolves a percentage font-size on <text> against the default, and says so', () => {
    const { nodes, warnings } = parse('<text font-size="150%">hi</text>');
    expect(nodes[0]).toMatchObject({ style: { fontSize: 24 } });
    expect(warnings).toEqual(['font-size "150%" on <text> is resolved against the 16px default']);
  });
  it('paints nothing for context-fill on a shape outside a marker', () => {
    const { nodes, warnings } = parse('<rect width="1" height="1" fill="context-fill"/>');
    expect((nodes[0] as SvgPathNode).fill).toEqual({ kind: 'none' });
    expect(warnings).toEqual([]);
  });
  it('lets color: currentColor inherit', () => {
    const g = parse('<g color="red"><rect width="1" height="1" color="currentColor" fill="currentColor"/></g>')
      .nodes[0] as { children: SvgPathNode[] };
    expect(g.children[0].fill).toMatchObject({ color: '#ff0000' });
  });
});
