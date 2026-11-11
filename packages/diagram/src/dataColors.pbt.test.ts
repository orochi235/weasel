/**
 * A data item's own colors over a style. `withColors` writes every color set, keeps every other field, leaves its
 * inputs alone, keeps a key named like an `Object.prototype` member as a plain own key, and is idempotent; the
 * `ownStyle` lists name exactly the colors set, in their fixed order; with no theme every item's style is its colors
 * over the defaults; `edgeStrokeOf` paints the style it is given, an arrow at the end unless told otherwise.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ownEdgeStyle, ownNodeStyle, withColors } from './dataColors';
import { DEFAULT_EDGE_STYLE, dataEdgeStyle, dataNodeStyle, dataRegionStyle } from './dataStyles';
import { DEFAULT_NODE_STYLE, EDGE_STROKE_WIDTH, type EdgeStyle, type NodeStyle } from './dataTypes';
import { edgeStrokeOf } from './edgeStroke';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 400;

const color = fc.constantFrom('#000', '#fff', 'red', 'rgb(1 2 3)', '');
const KEYS = ['fill', 'stroke', 'text', 'header', 'headerText', 'label', '__proto__', 'constructor', 'toString', 'hasOwnProperty'];
/** A bag of fields as `JSON.parse` would make it: every key its own, `__proto__` included. */
const bag = (values: fc.Arbitrary<unknown>) => fc.dictionary(fc.constantFrom(...KEYS), fc.option(values, { nil: undefined }), { maxKeys: 6 })
  .map((d) => JSON.parse(JSON.stringify(d, (_, v) => (v === undefined ? '\u0000undefined' : v)), (_, v) => (v === '\u0000undefined' ? undefined : v)) as Record<string, unknown>);

describe('withColors', () => {
  it('writes every color set over the style and keeps the rest, as own keys', () => {
    fc.assert(fc.property(bag(color), fc.option(bag(fc.oneof(color, fc.constant({ x: 1 }))), { nil: undefined }), (style, colors) => {
      const styleCopy = structuredClone(style);
      const colorsCopy = colors === undefined ? undefined : structuredClone(colors);
      const out = withColors(style, colors) as Record<string, unknown>;
      expect(style).toEqual(styleCopy);
      expect(colors).toEqual(colorsCopy);
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
      const keys = new Set([...Object.keys(style), ...Object.keys(colors ?? {}).filter((k) => colors![k] !== undefined)]);
      expect(new Set(Object.keys(out))).toEqual(keys);
      for (const k of keys) {
        const own = (o: Record<string, unknown> | undefined) => (o !== undefined && Object.hasOwn(o, k) ? o[k] : undefined);
        const want = own(colors) !== undefined ? own(colors) : own(style);
        expect(Object.getOwnPropertyDescriptor(out, k)?.value).toBe(want);
      }
      expect(withColors(out, colors)).toEqual(out);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

const nodeColors: fc.Arbitrary<Partial<NodeStyle>> = fc.record({ fill: color, stroke: color, text: color, header: color, headerText: color }, { requiredKeys: [] });
const edgeColors: fc.Arbitrary<Partial<EdgeStyle>> = fc.record({ stroke: color, label: color }, { requiredKeys: [] });

describe('ownNodeStyle and ownEdgeStyle', () => {
  it('name exactly the colors set, in a fixed order, and nothing for none', () => {
    fc.assert(fc.property(fc.option(nodeColors, { nil: undefined }), fc.option(edgeColors, { nil: undefined }), (n, e) => {
      const node = (['fill', 'stroke', 'text'] as const).filter((f) => n?.[f] !== undefined);
      expect(ownNodeStyle(n)).toEqual(node.length > 0 ? { ownStyle: node } : {});
      const edge = [...(e?.stroke !== undefined ? ['stroke'] : []), ...(e?.label !== undefined ? ['text'] : [])];
      expect(ownEdgeStyle(e)).toEqual(edge.length > 0 ? { ownStyle: edge } : {});
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('with no theme, style each item as its colors over the defaults', () => {
    fc.assert(fc.property(fc.option(nodeColors, { nil: undefined }), fc.option(edgeColors, { nil: undefined }), fc.constantFrom('container', 'pool', 'lane') as fc.Arbitrary<'container' | 'pool' | 'lane'>, (n, e, role) => {
      expect(dataNodeStyle({ colors: n })).toEqual(withColors(DEFAULT_NODE_STYLE, n));
      expect(dataEdgeStyle({ colors: e })).toEqual(withColors(DEFAULT_EDGE_STYLE, e));
      expect(dataRegionStyle({ role, colors: n })).toEqual(withColors(DEFAULT_NODE_STYLE, n));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

const marker = fc.constantFrom('arrow', 'circle', 'diamond') as fc.Arbitrary<never>;
const edgeStyle: fc.Arbitrary<EdgeStyle> = fc.record({
  stroke: color,
  width: fc.double({ min: 0, max: 10, noNaN: true }),
  dash: fc.array(fc.integer({ min: 0, max: 8 }), { maxLength: 4 }),
  markerStart: fc.option(marker, { nil: null }),
  markerEnd: fc.option(marker, { nil: null }),
  label: color,
  trim: fc.record({ start: fc.double({ min: 0, max: 1, noNaN: true }), end: fc.double({ min: 0, max: 1, noNaN: true }) }) as fc.Arbitrary<never>,
}, { requiredKeys: ['stroke'] });

describe('edgeStrokeOf', () => {
  it('paints the style\'s stroke, width, dash, and trim, an arrow at the end unless the style says otherwise', () => {
    fc.assert(fc.property(edgeStyle, (style) => {
      const stroke = edgeStrokeOf(style);
      expect(stroke.paint).toEqual({ color: style.stroke });
      expect(stroke.width).toBe(style.width ?? EDGE_STROKE_WIDTH);
      expect(stroke.dash).toEqual(style.dash);
      expect(stroke.trim).toEqual(style.trim);
      expect(stroke.markerStart).toBe(style.markerStart ?? undefined);
      expect(stroke.markerEnd).toBe(style.markerEnd === undefined ? 'arrow' : style.markerEnd ?? undefined);
      expect('markerStart' in stroke).toBe(style.markerStart != null);
      expect('markerEnd' in stroke).toBe(style.markerEnd !== null);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
