import { describe, it, expect } from 'vitest';
import { evaluateSupports } from './supports';
import { isDeclarationHonored, PROPERTIES, type PropertyName } from './properties';
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
    ['opacity', '50%'], ['fill-opacity', '25%'], ['font-size', '150%'], ['fill', 'context-stroke'],
  ])('honors %s: %s', (prop, value) => {
    expect(isDeclarationHonored(prop, value)).toBe(true);
  });

  it.each([
    ['fill', 'bogus'], ['color', 'url(#g)'], ['stop-color', 'currentColor'],
    ['stroke-linejoin', 'arcs'], ['stroke-linecap', 'triangle'], ['fill-rule', 'odd'],
    ['stroke-width', '2em'], ['stroke-width', 'thick'], ['stroke-dasharray', '4 -2'], ['stroke-miterlimit', '0.5'],
    ['opacity', '0.5x'], ['font-style', 'oblique'], ['stroke-linejoin', 'miter-clip'], ['letter-spacing', '0.1em'], ['font-size', '1em'], ['font-weight', 'lighter'],
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

describe('PROPERTIES is the parser\'s one pathway', () => {
  const SHAPE = '<path class="t" d="M0 0 L10 0 L10 10 Z"/>';
  const STOP = '<linearGradient id="g"><stop class="t" offset="0"/><stop offset="1" stop-color="white"/></linearGradient>'
    + '<rect width="1" height="1" fill="url(#g)"/>';
  const TEXT = '<text class="t">hi there</text>';
  interface Sample { readonly honored: string; readonly rejected?: string; readonly on: string; readonly base?: string }
  const shape = (honored: string, rejected?: string, base?: string): Sample => ({ honored, rejected, on: SHAPE, base });
  const stroked = (honored: string, rejected: string): Sample => shape(honored, rejected, 'stroke: black;');
  const text = (honored: string, rejected?: string): Sample => ({ honored, rejected, on: TEXT });
  // Typed against the table, so a property added there cannot go unsampled here.
  const SAMPLES: Record<PropertyName, Sample> = {
    'fill': shape('red', 'bogus'),
    'fill-opacity': shape('0.5', 'half'),
    'fill-rule': shape('evenodd', 'odd'),
    'stroke': shape('blue', 'bogus'),
    'stroke-width': stroked('3px', '3em'),
    'stroke-opacity': stroked('50%', 'half'),
    'stroke-linecap': stroked('round', 'triangle'),
    'stroke-linejoin': stroked('bevel', 'arcs'),
    'stroke-dasharray': stroked('4 2', '4 -2'),
    'stroke-miterlimit': stroked('8', '0.5'),
    'marker-start': stroked('url(#m)', 'url(a.svg#m)'),
    'marker-mid': stroked('url(#m)', 'url(a.svg#m)'),
    'marker-end': stroked('url(#m)', 'url(a.svg#m)'),
    'color': shape('red', 'url(#g)', 'fill: currentColor;'),
    'opacity': shape('0.5', 'half'),
    'vector-effect': stroked('non-scaling-stroke', 'non-scaling-size'),
    'font-size': text('20px', '2em'),
    'font-family': text('serif'),
    'font-weight': text('600', 'lighter'),
    'font-style': text('italic', 'oblique'),
    'text-anchor': text('middle', 'left'),
    'letter-spacing': text('2px', '0.1em'),
    'text-decoration': text('underline', 'underline wavy'),
    'direction': text('rtl', 'sideways'),
    'text-transform': text('uppercase', 'full-width'),
    'baseline-shift': text('super', '3pt'),
    'stop-color': { honored: 'blue', rejected: 'currentColor', on: STOP },
    'stop-opacity': { honored: '0.5', rejected: 'half', on: STOP },
  };
  const parse = (css: string, body: string) => parseSvg(
    `<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="m"><path d="M0 0 L1 1"/></marker></defs>`
    + `<style>.t { ${css} }</style>${body}</svg>`,
  );

  it('samples every property in the table', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(PROPERTIES).sort());
  });
  it.each(Object.entries(SAMPLES))('a value it honors changes the parse, and cleanly: %s', (prop, s) => {
    expect(isDeclarationHonored(prop, s.honored)).toBe(true);
    const base = s.base ?? '';
    const out = parse(`${base} ${prop}: ${s.honored}`, s.on);
    expect(out.nodes).not.toEqual(parse(base, s.on).nodes);
    expect(out.warnings).toEqual([]);
  });
  it.each(Object.entries(SAMPLES).filter(([, s]) => s.rejected != null))(
    'a value it rejects is ignored or reported: %s',
    (prop, s) => {
      expect(isDeclarationHonored(prop, s.rejected!)).toBe(false);
      const base = s.base ?? '';
      const out = parse(`${base} ${prop}: ${s.rejected}`, s.on);
      if (out.warnings.length === 0) expect(out.nodes).toEqual(parse(base, s.on).nodes);
    },
  );
  it('is the only way the parser reads a presentation property', () => {
    const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true });
    const names = Object.keys(PROPERTIES).join('|');
    const bypass = new RegExp(`getAttribute\\(\\s*['"](${names})['"]`);
    expect(Object.keys(files)).toContain('./parse.ts');
    const offenders = Object.entries(files)
      .filter(([path, src]) => !path.endsWith('.test.ts') && bypass.test(src as string))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
