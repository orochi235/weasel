import { describe, it, expect } from 'vitest';
import { deriveStyle, EMPTY_STYLE, ownProp, readStyleProp, resolveCurrentColor } from './cascade';

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

describe('readStyleProp', () => {
  it('extracts a declaration and trims it', () => {
    const get = els('<svg><rect id="r" style="fill: #abcabc ; stroke:#000"/></svg>');
    expect(readStyleProp(get('r'), 'fill')).toBe('#abcabc');
    expect(readStyleProp(get('r'), 'stroke')).toBe('#000');
  });
  it('returns null when the property is absent', () => {
    const get = els('<svg><rect id="r" style="stroke:#000"/></svg>');
    expect(readStyleProp(get('r'), 'fill')).toBeNull();
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
