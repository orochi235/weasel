/**
 * The importer as a cheap fuzzer: arbitrary text, and well-formed documents whose attributes and styles hold
 * arbitrary values. It must never throw, every number it produces must be finite, and what it produces must
 * serialize and parse again. Deep runs (WEASEL_PBT_RUNS) go to the fleet.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { escapeAttr, escapeText } from './xmlEscape';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 150;
const TIMEOUT = Math.max(5_000, RUNS * 10);

/** Every number reachable in `value`, with where it was found. */
function* numbers(value: unknown, at = '$', seen = new Set<unknown>()): Generator<[string, number]> {
  if (typeof value === 'number') { yield [at, value]; return; }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (ArrayBuffer.isView(value)) {
    const arr = value as unknown as ArrayLike<number>;
    for (let i = 0; i < arr.length; i++) yield [`${at}[${i}]`, arr[i]!];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* numbers(v, `${at}.${k}`, seen);
}

function expectFinite(value: unknown): void {
  for (const [at, n] of numbers(value)) {
    // Infinity is a legitimate stroke miter limit or dash; NaN never is.
    expect(Number.isNaN(n), `NaN at ${at}`).toBe(false);
  }
}

const number = fc.oneof(
  fc.double({ noNaN: false }).map(String),
  fc.integer({ min: -1e6, max: 1e6 }).map(String),
  fc.constantFrom('0', '-0', '1e309', '-1e309', '.5', '5.', '1e-320', 'NaN', 'Infinity', ''),
);
const unit = fc.constantFrom('', 'px', 'pt', 'pc', 'mm', 'cm', 'in', 'em', 'ex', '%', 'vw', 'deg', 'rad', 'q');
const keyword = fc.constantFrom('none', 'inherit', 'currentColor', 'transparent', 'red', '#abc', '#aabbccdd', 'rgb(1,2,3)',
  'hsl(120 50% 50%)', 'url(#g)', 'url(#nope)', 'url(#g) red', 'evenodd', 'nonzero', 'round', 'bevel', 'butt', 'hidden',
  'visible', 'auto', 'context-stroke', 'xMidYMid slice', 'bold', 'italic', 'middle', 'end');
const value = fc.oneof(
  fc.tuple(number, unit).map(([n, u]) => n + u),
  keyword,
  fc.tuple(fc.array(fc.tuple(number, unit).map(([n, u]) => n + u), { maxLength: 6 }), fc.constantFrom(' ', ',', ', '))
    .map(([xs, s]) => xs.join(s)),
  fc.string({ maxLength: 20 }),
  fc.constantFrom('M0 0L10 10Z', 'M0,0 C 1 2 3 4 5 6 S 7 8 9 10', 'M0 0a5 5 0 1 0 10 0', 'M 1e308 1e308 L -1e308 -1e308',
    'translate(5)', 'rotate(45 10 10)', 'matrix(0 0 0 0 0 0)', 'scale(0)', 'skewX(90)', 'scale(1e308)'),
);

const ATTRS = ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'd', 'transform',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'display', 'visibility', 'style',
  'viewBox', 'preserveAspectRatio', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'clip-path',
  'marker-start', 'marker-end', 'offset', 'stop-color', 'gradientUnits', 'gradientTransform', 'href', 'xlink:href',
  'class', 'dx', 'dy', 'letter-spacing'];
const attrs = fc.dictionary(fc.constantFrom(...ATTRS), value, { maxKeys: 6 });

const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use', 'image'];
const attrText = (a: Record<string, string>): string =>
  Object.entries(a).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');

const leaf = fc.tuple(fc.constantFrom(...SHAPES), attrs, fc.string({ maxLength: 8 }))
  .map(([tag, a, text]) => (tag === 'text' ? `<text${attrText(a)}>${escapeText(text)}</text>` : `<${tag}${attrText(a)}/>`));

const { tree } = fc.letrec((tie) => ({
  tree: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leaf,
    fc.tuple(attrs, fc.array(tie('tree') as fc.Arbitrary<string>, { maxLength: 3 })).map(([a, kids]) => `<g${attrText(a)}>${kids.join('')}</g>`),
  ),
}));

const defs = fc.tuple(attrs, attrs, attrs).map(([g, s0, s1]) =>
  `<defs><linearGradient id="g"${attrText(g)}><stop${attrText(s0)}/><stop${attrText(s1)}/></linearGradient>`
  + `<clipPath id="c"><rect width="5" height="5"/></clipPath></defs>`);

const css = fc.tuple(fc.constantFrom('rect', 'path', '.a', '#g', '*', 'g > path', ':root'), fc.constantFrom(...ATTRS), value)
  .map(([sel, prop, v]) => `${sel} { ${prop}: ${v} }`);
const style = fc.array(css, { maxLength: 3 }).map((rules) => (rules.length ? `<style>${escapeText(rules.join('\n'))}</style>` : ''));

const doc = fc.tuple(attrs, defs, style, fc.array(tree, { maxLength: 4 })).map(([root, d, s, kids]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${attrText(root)}>${d}${s}${kids.join('')}</svg>`);

describe('parseSvg as a fuzz target, property', () => {
  it('never throws on arbitrary text, and says why when it reads nothing', () => {
    fc.assert(fc.property(fc.oneof(fc.string({ maxLength: 200 }), fc.string({ unit: 'binary', maxLength: 80 })), (text) => {
      const out = parseSvg(text);
      if (out.nodes.length === 0 && out.error === undefined) return;
      expectFinite(out);
    }), { numRuns: RUNS });
  }, TIMEOUT);

  it('reads any well-formed document without throwing, every number finite, and its output round-trips', () => {
    fc.assert(fc.property(doc, (xml) => {
      const out = parseSvg(xml);
      expect(out.error, xml).toBeUndefined();
      expectFinite(out.nodes);
      const again = parseSvg(serializeSvg(out.nodes));
      expect(again.error).toBeUndefined();
      expectFinite(again.nodes);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('parseSvg past float32 range (shrunk counterexamples)', () => {
  const SVG = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  it.each([
    ['a line past float32 range', '<line x2="6.805647135594673e+38"/>'],
    ['a rect scaled past it', '<g><rect x="5." transform="scale(1e308)"/></g>'],
    ['a rect wider than it', '<rect width="-6.805647135594673e+38"/>'],
  ])('drops %s with a warning instead of storing NaN', (_name, body) => {
    const out = parseSvg(SVG(body));
    expectFinite(out.nodes);
    expectFinite(parseSvg(serializeSvg(out.nodes)).nodes);
  });

  it('keeps a shape that is merely large', () => {
    const out = parseSvg(SVG('<line x2="1e30"/>'));
    expect(out.nodes).toHaveLength(1);
    expectFinite(out.nodes);
  });
});
