/**
 * `<use>` expansion against a model: random graphs of groups and symbols referencing each other, themselves,
 * and ids nobody defines. Every reference draws its target's content once per path to it; one that would draw
 * itself again, or sits inside its own target, is refused with the cycle warning; one naming nothing warns that
 * it does; and no graph hangs or overflows, however it nests or multiplies.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg, NESTING_LIMIT } from './parse';
import { USE_ELEMENT_BUDGET } from './use';
import type { SvgNode } from './types';
import { runs, timeoutFor } from './pbt.fixture';

const N = 300;

/** A rect, or a reference to def `use` (a number past the last def names nothing). */
type Item = 'rect' | { use: number };
const item = (defs: number): fc.Arbitrary<Item> => fc.oneof(
  fc.constant('rect' as const),
  fc.integer({ min: 0, max: defs }).map((use) => ({ use })),
);

const graph = fc.integer({ min: 1, max: 4 }).chain((k) => fc.record({
  defs: fc.array(fc.record({ symbol: fc.boolean(), items: fc.array(item(k), { maxLength: 3 }) }), { minLength: k, maxLength: k }),
  body: fc.array(item(k), { minLength: 1, maxLength: 3 }),
}));

const SVG = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`;

function leaves(nodes: readonly SvgNode[]): number {
  return nodes.reduce((n, c) => n + (c.kind === 'group' ? leaves(c.children) : 1), 0);
}

describe('<use> expansion, property', () => {
  it('draws each target once per path to it, refusing cycles and missing ids with their warnings', () => {
    let cycles = 0, missing = 0, deep = 0;
    fc.assert(fc.property(graph, fc.boolean(), ({ defs, body }, xlink) => {
      let sawCycle = false, sawMissing = false;
      // A <use> is one element: where it sits (a def's index, or -1 for the body) and its place there.
      const draw = (items: readonly Item[], at: number, stack: string[]): number => items.reduce((sum, it, i) => {
        if (it === 'rect') return sum + 1;
        const target = defs[it.use];
        if (!target) { sawMissing = true; return sum; }
        const self = `${at}:${i}`;
        if (stack.includes(self) || at === it.use) { sawCycle = true; return sum; }
        if (stack.length >= 2) deep++;
        return sum + draw(target.items, it.use, [...stack, self]);
      }, 0);
      const want = draw(body, -1, []);
      if (sawCycle) cycles++;
      if (sawMissing) missing++;

      const href = xlink ? 'xlink:href' : 'href';
      const xmlOf = (items: readonly Item[]): string => items.map((it) => (it === 'rect'
        ? '<rect width="1" height="1"/>'
        : `<use ${href}="#e${it.use}"/>`)).join('');
      const xml = SVG(`<defs>${defs.map((d, j) => {
        const tag = d.symbol ? 'symbol' : 'g';
        return `<${tag} id="e${j}">${xmlOf(d.items)}</${tag}>`;
      }).join('')}</defs>${xmlOf(body)}`);
      const out = parseSvg(xml);
      expect(leaves(out.nodes), xml).toBe(want);
      expect(out.warnings.some((w) => w.includes('part of a reference cycle')), xml).toBe(sawCycle);
      expect(out.warnings.some((w) => w.includes('which the document does not define')), xml).toBe(sawMissing);
    }), runs(N));
    for (const n of [cycles, missing, deep]) expect(n).toBeGreaterThan(runs(N).numRuns / 10);
  }, timeoutFor(N, 10));
});

describe('<use> expansion that would not end (shrunk to the smallest that hung or overflowed)', () => {
  it(`stops a doubling chain at ${USE_ELEMENT_BUDGET} elements drawn, and says so`, () => {
    let defs = '<g id="l0"><rect width="1" height="1"/></g>';
    for (let i = 1; i <= 40; i++) defs += `<g id="l${i}"><use href="#l${i - 1}"/><use href="#l${i - 1}"/></g>`;
    const out = parseSvg(SVG(`<defs>${defs}</defs><use href="#l40"/>`));
    expect(leaves(out.nodes)).toBeGreaterThan(0);
    expect(leaves(out.nodes)).toBeLessThanOrEqual(USE_ELEMENT_BUDGET);
    expect(out.warnings.filter((w) => w.includes(`more than ${USE_ELEMENT_BUDGET} elements`))).toHaveLength(1);
  });

  it(`stops a chain of references nested past ${NESTING_LIMIT} deep, which overflowed the stack`, () => {
    let defs = '<g id="l0"><rect width="1" height="1"/></g>';
    for (let i = 1; i <= 3000; i++) defs += `<g id="l${i}"><use href="#l${i - 1}"/></g>`;
    const out = parseSvg(SVG(`<defs>${defs}</defs><use href="#l3000"/>`));
    expect(out.error).toBeUndefined();
    expect(out.warnings).toContain(`elements nest more than ${NESTING_LIMIT} deep; what is deeper is not drawn`);
  });

  it(`draws the top ${NESTING_LIMIT} levels of groups nested deeper, which overflowed the stack`, () => {
    const depth = 3000;
    const out = parseSvg(SVG(`${'<g>'.repeat(depth)}<rect width="1" height="1"/>${'</g>'.repeat(depth)}<rect width="2" height="2"/>`));
    expect(out.error).toBeUndefined();
    expect(out.nodes).toHaveLength(2);
    expect(out.warnings).toContain(`elements nest more than ${NESTING_LIMIT} deep; what is deeper is not drawn`);
  });
});
