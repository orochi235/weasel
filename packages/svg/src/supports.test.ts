import { describe, it, expect } from 'vitest';
import { evaluateSupports } from './supports';
import { isDeclarationHonored } from './properties';
import { parseSvg } from './parse';

describe('isDeclarationHonored', () => {
  it.each([
    ['fill', 'red'], ['fill', '#0f0'], ['fill', 'none'], ['fill', 'url(#g)'], ['fill', 'currentColor'],
    ['stroke', 'rgb(0 0 0)'], ['color', 'hsl(10 50% 50%)'], ['stop-color', 'blue'],
    ['fill-opacity', '0.5'], ['opacity', '1'], ['stop-opacity', '.2'], ['stroke-opacity', '0'],
    ['fill-rule', 'evenodd'], ['fill-rule', 'nonzero'],
    ['stroke-width', '2'], ['stroke-width', '2px'],
    ['stroke-linecap', 'round'], ['stroke-linejoin', 'bevel'],
    ['stroke-dasharray', '4 2'], ['stroke-dasharray', 'none'], ['stroke-miterlimit', '4'],
    ['marker-end', 'url(#m)'], ['marker-start', 'none'],
    ['font-size', '12'], ['font-size', '12px'], ['font-family', 'serif'],
    ['font-weight', 'bold'], ['font-weight', '600'], ['font-style', 'italic'],
    ['text-anchor', 'middle'], ['letter-spacing', '1px'], ['letter-spacing', 'normal'],
    ['text-decoration', 'underline line-through'], ['direction', 'rtl'], ['text-transform', 'uppercase'],
    ['baseline-shift', 'super'], ['baseline-shift', '20%'], ['baseline-shift', '0.3em'],
    ['vector-effect', 'non-scaling-stroke'],
    ['fill', 'inherit'], ['FILL', 'RED'],
  ])('honors %s: %s', (prop, value) => {
    expect(isDeclarationHonored(prop, value)).toBe(true);
  });

  it.each([
    ['fill', 'bogus'], ['fill', 'context-fill'], ['color', 'url(#g)'],
    ['stroke-linejoin', 'arcs'], ['stroke-linecap', 'triangle'], ['fill-rule', 'odd'],
    ['stroke-width', '2em'], ['stroke-width', 'thick'], ['stroke-dasharray', '4 -2'], ['stroke-miterlimit', '0.5'],
    ['opacity', '50%'], ['letter-spacing', '0.1em'], ['font-size', '1em'], ['font-weight', 'lighter'],
    ['text-anchor', 'left'], ['direction', 'sideways'], ['text-transform', 'full-width'],
    ['marker-end', 'url(other.svg#m)'], ['vector-effect', 'non-scaling-size'],
    ['display', 'none'], ['transform', 'rotate(10deg)'], ['clip-path', 'url(#c)'], ['--custom', 'x'],
    ['opacity', 'inherit'], ['fill', 'initial'],
  ])('does not honor %s: %s', (prop, value) => {
    expect(isDeclarationHonored(prop, value)).toBe(false);
  });
});

describe('evaluateSupports', () => {
  it('evaluates a declaration test', () => {
    expect(evaluateSupports('(fill: red)')).toBe(true);
    expect(evaluateSupports('( fill : red )')).toBe(true);
    expect(evaluateSupports('(fill: red !important)')).toBe(true);
    expect(evaluateSupports('(display: grid)')).toBe(false);
  });
  it('combines with not, and, or and nesting', () => {
    expect(evaluateSupports('not (display: grid)')).toBe(true);
    expect(evaluateSupports('(fill: red) and (stroke: blue)')).toBe(true);
    expect(evaluateSupports('(fill: red) and (display: grid)')).toBe(false);
    expect(evaluateSupports('(display: grid) or (fill: red)')).toBe(true);
    expect(evaluateSupports('not ((display: grid) or (transform: none))')).toBe(true);
    expect(evaluateSupports('((fill: red) and (stroke: red)) or (display: grid)')).toBe(true);
  });
  it('rejects mixing and with or at one level, and anything malformed', () => {
    expect(evaluateSupports('(fill: red) and (stroke: red) or (color: red)')).toBe(false);
    expect(evaluateSupports('fill: red')).toBe(false);
    expect(evaluateSupports('(fill: red) (stroke: red)')).toBe(false);
    expect(evaluateSupports('')).toBe(false);
    expect(evaluateSupports('(fill: red) and')).toBe(false);
  });
  it('evaluates general-enclosed and unknown functions false, so not of one is true', () => {
    expect(evaluateSupports('(foo bar)')).toBe(false);
    expect(evaluateSupports('not (foo bar)')).toBe(true);
    expect(evaluateSupports('font-tech(color-COLRv1)')).toBe(false);
    expect(evaluateSupports('font-format(woff2)')).toBe(false);
  });
  it('answers selector() through the supplied checker', () => {
    const selector = (s: string): boolean => s.trim() === 'a > b';
    expect(evaluateSupports('selector(a > b)', { selector })).toBe(true);
    expect(evaluateSupports('selector(a >>> b)', { selector })).toBe(false);
    expect(evaluateSupports('selector(a > b)')).toBe(false);
  });
});

describe('isDeclarationHonored agrees with the parser', () => {
  const fillOf = (css: string): unknown => {
    const { nodes } = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><style>rect { ${css} }</style><rect width="1" height="1"/></svg>`);
    return nodes[0];
  };
  it.each([
    ['fill', 'red'], ['stroke', 'blue'], ['fill-opacity', '0.5'], ['opacity', '0.5'],
    ['stroke-width', '3px'], ['stroke-linecap', 'round'], ['stroke-dasharray', '4 2'],
  ])('a declaration it calls honored changes the parse: %s: %s', (prop, value) => {
    const base = prop.startsWith('stroke-') ? 'stroke: black;' : '';
    expect(fillOf(`${base} ${prop}: ${value}`)).not.toEqual(fillOf(base));
  });
});
