import { describe, it, expect } from 'vitest';
import {
  deriveStyle, EMPTY_STYLE, ownProp, parseDeclarations, parseStylesheet, resolveCurrentColor, specificity,
} from './cascade';

/** Parse an SVG string and return a lookup by element id. */
function els(svg: string): (id: string) => Element {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return (id) => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`no #${id}`);
    return found;
  };
}

describe('deriveStyle', () => {
  it('folds an element own fill onto the parent cascade', () => {
    const get = els('<svg><rect id="r" fill="#ff0000"/></svg>');
    const style = deriveStyle(EMPTY_STYLE, get('r'));
    expect(style['fill']).toBe('#ff0000');
  });

  it('own value overrides an inherited value', () => {
    const get = els('<svg id="s" fill="#000000"><rect id="r" fill="#ff0000"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('r'));
    expect(style['fill']).toBe('#ff0000');
  });

  it('absent property keeps the parent value (and returns the same object)', () => {
    const get = els('<svg id="s" fill="#00ff00"><g id="g"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('g'));
    expect(style['fill']).toBe('#00ff00');
    expect(style).toBe(parent); // no own inheritable attrs → no clone
  });

  it('the `inherit` keyword keeps the parent value', () => {
    const get = els('<svg id="s" fill="#00ff00"><rect id="r" fill="inherit"/></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('s'));
    const style = deriveStyle(parent, get('r'));
    expect(style['fill']).toBe('#00ff00');
  });

  it('resolves to the nearest ancestor across multiple levels', () => {
    const get = els('<svg id="s" fill="#111111"><g id="g" fill="#222222"><rect id="r"/></g></svg>');
    const a = deriveStyle(EMPTY_STYLE, get('s'));
    const b = deriveStyle(a, get('g'));
    const c = deriveStyle(b, get('r'));
    expect(c['fill']).toBe('#222222');
  });

  it('style="" beats the presentation attribute on the same element', () => {
    const get = els('<svg><rect id="r" fill="#111111" style="fill:#999999"/></svg>');
    const style = deriveStyle(EMPTY_STYLE, get('r'));
    expect(style['fill']).toBe('#999999');
  });

  it('inherits letter-spacing from an ancestor <g> into a <text>', () => {
    const get = els('<svg><g id="g" letter-spacing="3"><text id="t">hi</text></g></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('g'));
    const style = deriveStyle(parent, get('t'));
    expect(style['letter-spacing']).toBe('3');
  });

  it('inherits text-decoration from an ancestor <g> into a <text>', () => {
    const get = els('<svg><g id="g" text-decoration="underline"><text id="t">hi</text></g></svg>');
    const parent = deriveStyle(EMPTY_STYLE, get('g'));
    const style = deriveStyle(parent, get('t'));
    expect(style['text-decoration']).toBe('underline');
  });
});

describe('parseDeclarations', () => {
  it('extracts declarations, trimmed, with property names lowercased', () => {
    expect(parseDeclarations('fill: #abcabc ; STROKE:#000')).toEqual([
      { prop: 'fill', value: '#abcabc', important: false },
      { prop: 'stroke', value: '#000', important: false },
    ]);
  });
  it('reads !important, with or without inner whitespace', () => {
    expect(parseDeclarations('fill:red !important;stroke:blue! IMPORTANT')).toEqual([
      { prop: 'fill', value: 'red', important: true },
      { prop: 'stroke', value: 'blue', important: true },
    ]);
  });
  it('does not split inside parentheses or quotes', () => {
    expect(parseDeclarations(`fill:url("a;b");font-family:'x;y', serif`)).toEqual([
      { prop: 'fill', value: 'url("a;b")', important: false },
      { prop: 'font-family', value: "'x;y', serif", important: false },
    ]);
  });
  it('drops declarations with no colon or an empty value, and strips comments', () => {
    expect(parseDeclarations('garbage; fill:; /* c */ stroke: /* d */ red')).toEqual([
      { prop: 'stroke', value: 'red', important: false },
    ]);
  });
});

describe('specificity', () => {
  it('counts ids, classes/attributes/pseudo-classes, and types', () => {
    expect(specificity('rect')).toEqual([0, 0, 1]);
    expect(specificity('.a')).toEqual([0, 1, 0]);
    expect(specificity('#x')).toEqual([1, 0, 0]);
    expect(specificity('g > rect.a[fill="#f00"]:first-child')).toEqual([0, 3, 2]);
    expect(specificity('*')).toEqual([0, 0, 0]);
    expect(specificity('g#x .a .b rect')).toEqual([1, 2, 2]);
  });
  it('does not count characters inside attribute values', () => {
    expect(specificity('[data-k="#a.b c"]')).toEqual([0, 1, 0]);
  });
  it('takes :not / :is from their most specific argument and :where as zero', () => {
    expect(specificity(':not(#a, .b)')).toEqual([1, 0, 0]);
    expect(specificity('rect:is(.a, g .b .c)')).toEqual([0, 2, 2]);
    expect(specificity(':where(#a) rect')).toEqual([0, 0, 1]);
  });
});

describe('parseStylesheet', () => {
  it('splits comma lists into one rule per selector, in source order', () => {
    const rules = parseStylesheet('.a, #b { fill: red } rect{stroke:blue}');
    expect(rules.map((r) => r.selector)).toEqual(['.a', '#b', 'rect']);
    expect(rules[0].declarations).toEqual([{ prop: 'fill', value: 'red', important: false }]);
    expect(rules[0].order).toBeLessThan(rules[2].order);
  });
  it('skips comments, CDATA / HTML comment markers, and at-rules', () => {
    const rules = parseStylesheet(`<![CDATA[ <!--
      @charset "utf-8";
      @import url(x.css);
      /* .gone { fill: red } */
      @media print { .p { fill: red } }
      @font-face { font-family: X; src: url(x.woff) }
      .kept { fill: #00f }
    --> ]]>`);
    expect(rules.map((r) => r.selector)).toEqual(['.kept']);
  });
  it('ignores a nested block inside a rule body', () => {
    const rules = parseStylesheet('.a { fill: red; &:hover { fill: blue } stroke: green }');
    expect(rules[0].declarations.map((d) => d.prop)).toEqual(['fill', 'stroke']);
  });
});

describe('stylesheet cascade', () => {
  const svg = (style: string, body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg"><style>${style}</style>${body}</svg>`;

  it('applies a class rule', () => {
    const get = els(svg('.cls-1{fill:#f00}', '<rect id="r" class="cls-1"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('a stylesheet rule beats the presentation attribute', () => {
    const get = els(svg('rect{fill:#f00}', '<rect id="r" fill="#0f0"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('inline style beats any stylesheet rule', () => {
    const get = els(svg('#r{fill:#f00}', '<rect id="r" style="fill:#00f"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#00f');
  });

  it('higher specificity wins regardless of source order', () => {
    const get = els(svg('#r{fill:#f00} .a{fill:#0f0} rect{fill:#00f}', '<rect id="r" class="a"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('equal specificity resolves by source order, across <style> elements', () => {
    const get = els(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#f00}</style>'
        + '<rect id="r" class="a b"/><style>.b{fill:#0f0}</style></svg>',
    );
    expect(ownProp(get('r'), 'fill')).toBe('#0f0');
  });

  it('!important in a rule beats normal inline style', () => {
    const get = els(svg('.a{fill:#f00 !important}', '<rect id="r" class="a" style="fill:#00f"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('!important inline beats !important in a rule', () => {
    const get = els(svg('#r{fill:#f00 !important}', '<rect id="r" style="fill:#00f !important"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#00f');
  });

  it('an !important rule of lower specificity beats a normal one of higher', () => {
    const get = els(svg('rect{fill:#f00 !important} #r{fill:#0f0}', '<rect id="r"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('within one declaration block the later declaration wins', () => {
    const get = els(svg('', '<rect id="r" style="fill:#f00; fill:#0f0"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#0f0');
  });

  it('matches descendant, child, attribute, and type selectors', () => {
    const get = els(svg(
      'g.outer rect{fill:#111} g > circle{fill:#222} [data-k="v"]{stroke:#333}',
      '<g class="outer"><g><rect id="r"/><circle id="c"/></g></g><circle id="c2" data-k="v"/>',
    ));
    expect(ownProp(get('r'), 'fill')).toBe('#111');
    expect(ownProp(get('c'), 'fill')).toBe('#222');
    expect(ownProp(get('c2'), 'fill')).toBeNull();
    expect(ownProp(get('c2'), 'stroke')).toBe('#333');
  });

  it('skips a selector the engine cannot match without dropping the rest of the list', () => {
    const get = els(svg('rect::before, .a{fill:#f00} :bogus(1){fill:#0f0}', '<rect id="r" class="a"/>'));
    expect(ownProp(get('r'), 'fill')).toBe('#f00');
  });

  it('a class-matched fill inherits through a group', () => {
    const get = els(svg('.g{fill:#f00}', '<g id="g" class="g"><rect id="r"/></g>'));
    const parent = deriveStyle(EMPTY_STYLE, get('g'));
    expect(deriveStyle(parent, get('r'))['fill']).toBe('#f00');
  });

  it('ignores a <style> whose type is not CSS', () => {
    const get = els(
      '<svg xmlns="http://www.w3.org/2000/svg"><style type="text/less">.a{fill:#f00}</style>'
        + '<rect id="r" class="a"/></svg>',
    );
    expect(ownProp(get('r'), 'fill')).toBeNull();
  });
});

describe('ownProp', () => {
  it('prefers style="" over the attribute', () => {
    const get = els('<svg><rect id="r" fill="#111111" style="fill:#999999"/></svg>');
    expect(ownProp(get('r'), 'fill')).toBe('#999999');
  });
  it('falls back to the attribute', () => {
    const get = els('<svg><rect id="r" fill="#111111"/></svg>');
    expect(ownProp(get('r'), 'fill')).toBe('#111111');
  });
});

describe('resolveCurrentColor', () => {
  it('resolves currentColor to the cascade color', () => {
    expect(resolveCurrentColor('currentColor', { color: '#00ff00' })).toBe('#00ff00');
  });
  it('is case-insensitive and trims', () => {
    expect(resolveCurrentColor('  CURRENTCOLOR ', { color: '#00ff00' })).toBe('#00ff00');
  });
  it('defaults to black when color is unset', () => {
    expect(resolveCurrentColor('currentColor', EMPTY_STYLE)).toBe('#000000');
  });
  it('passes other values through unchanged', () => {
    expect(resolveCurrentColor('#123456', { color: '#00ff00' })).toBe('#123456');
  });
  it('returns null for null input', () => {
    expect(resolveCurrentColor(null, EMPTY_STYLE)).toBeNull();
  });
});
