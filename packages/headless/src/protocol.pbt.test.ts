/**
 * Property tests of what crosses between Node and the page: a snapshot holding typed arrays of every kind at any
 * depth, `__proto__` keys and non-finite floats included, comes back through JSON as itself; a request survives
 * JSON and reads back as itself; one with any field broken is refused with an error naming it, and any JSON at
 * all is read or refused, never thrown on as a `TypeError`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readPageRequest, sceneFromWire, sceneToWire, type PageRequest } from './protocol';

function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}
const timeoutFor = (n: number, msPerRun: number): number => Math.max(5_000, runs(n).numRuns * msPerRun);

const ints = (min: number, max: number) => fc.array(fc.integer({ min, max }), { maxLength: 6 });
const floats = fc.array(fc.oneof(
  fc.double(),
  fc.constantFrom(Number.NaN, Infinity, -Infinity),
), { maxLength: 6 });
const typed = fc.oneof(
  ints(-128, 127).map((a) => Int8Array.from(a)),
  ints(0, 255).map((a) => Uint8Array.from(a)),
  ints(0, 255).map((a) => Uint8ClampedArray.from(a)),
  ints(-32768, 32767).map((a) => Int16Array.from(a)),
  ints(0, 65535).map((a) => Uint16Array.from(a)),
  ints(-(2 ** 31), 2 ** 31 - 1).map((a) => Int32Array.from(a)),
  ints(0, 2 ** 32 - 1).map((a) => Uint32Array.from(a)),
  floats.map((a) => Float32Array.from(a)),
  floats.map((a) => Float64Array.from(a)),
);
const key = fc.oneof(fc.string({ maxLength: 5 }), fc.constantFrom('__proto__', 'constructor', 'toString', '__ta', 'data'));
/** An object with every key its own, `__proto__` included, as `JSON.parse` makes one. */
const own = (pairs: [string, unknown][]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of pairs) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
};
const { tree } = fc.letrec((tie) => ({
  tree: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.oneof(fc.string({ maxLength: 4 }), fc.integer(), fc.boolean(), fc.constant(null), typed),
    fc.array(tie('tree'), { maxLength: 3 }),
    fc.array(fc.tuple(key, tie('tree')), { maxLength: 3 }).map(own),
  ),
}));

/** Typed arrays as `[class, values]`, so a comparison sees their type and `NaN` as itself. */
const plain = (v: unknown): unknown => {
  if (ArrayBuffer.isView(v)) return [v.constructor.name, Array.from(v as Float64Array, (n) => (Number.isNaN(n) ? 'NaN' : n))];
  if (Array.isArray(v)) return v.map(plain);
  if (v !== null && typeof v === 'object') return Object.entries(v).map(([k, x]) => [k, plain(x)]);
  return v;
};

describe('scene snapshots on the wire', () => {
  it('come back through JSON as they went, typed arrays of every kind and non-finite floats included', () => {
    let arrays = 0;
    let nonFinite = 0;
    fc.assert(fc.property(fc.array(fc.tuple(key, tree), { maxLength: 4 }).map(own), fc.boolean(), (snapshot, live) => {
      const scene = live ? { toJSON: () => snapshot } : snapshot;
      const json = JSON.stringify(sceneToWire(scene));
      const back = sceneFromWire(JSON.parse(json) as object);
      expect(plain(back)).toEqual(plain(snapshot));
      arrays += (json.match(/"__ta"/g) ?? []).length;
      nonFinite += (json.match(/"(NaN|-?Infinity)"/g) ?? []).length;
      expect(JSON.stringify(sceneToWire(back))).toBe(json);
    }), runs(300));
    expect(arrays).toBeGreaterThan(100);
    expect(nonFinite).toBeGreaterThan(20);
  }, timeoutFor(300, 3));
});

const num = fc.double({ min: -1e6, max: 1e6, noNaN: true }).filter((n) => !Object.is(n, -0));
const request: fc.Arbitrary<PageRequest> = fc.record({
  scene: fc.constant({ nodes: [], layers: [] }),
  sourceRect: fc.record({ x: num, y: num, width: num.filter((v) => v > 0), height: num.filter((v) => v > 0) }),
  scale: fc.record({ x: num.filter((v) => v !== 0), y: num.filter((v) => v !== 0) }),
  format: fc.constantFrom('rgba' as const, 'png' as const),
  background: fc.option(fc.constantFrom('#fff', 'transparent'), { nil: undefined }),
  flattenTolerancePx: fc.option(num, { nil: undefined }),
  annotations: fc.option(fc.boolean(), { nil: undefined }),
  overlay: fc.option(fc.constant([{ kind: 'group', children: [] }]), { nil: undefined }),
  screen: fc.option(fc.array(num, { minLength: 9, maxLength: 9 }), { nil: undefined }),
}, { requiredKeys: ['scene', 'sourceRect', 'scale', 'format'] });

/** A request with one field set to what JSON or a careless caller can put there. */
const broken = fc.tuple(request, fc.constantFrom(
  ['scene', null], ['scene', 'x'], ['scene', [1]], ['sourceRect', undefined], ['sourceRect', null],
  ['sourceRect.width', null], ['sourceRect.width', 0], ['sourceRect.height', -1], ['sourceRect.x', '1'], ['scale', 3],
  ['scale.y', null], ['scale.x', Infinity], ['scale.x', 0],
  ['format', 'jpeg'], ['format', undefined], ['background', 3], ['flattenTolerancePx', null], ['annotations', 'yes'],
  ['overlay', {}], ['overlay', [null]], ['screen', [1, 2, 3]], ['screen', 'abc'], ['screen.4', null],
) as fc.Arbitrary<[string, unknown]>).map(([req, [path, value]]) => {
  const out = JSON.parse(JSON.stringify(req)) as Record<string, unknown>;
  const [head, tail] = path.split('.');
  if (tail === undefined) out[head!] = value;
  else if (head === 'screen') out.screen = Array.from({ length: 9 }, (_, i) => (String(i) === tail ? value : 0));
  else (out[head!] as Record<string, unknown>)[tail] = value;
  return { req: out, field: head! };
});

describe('render requests', () => {
  it('read back as themselves through JSON', () => {
    fc.assert(fc.property(request, (req) => {
      const sent = JSON.parse(JSON.stringify(req)) as unknown;
      expect(readPageRequest(sent)).toEqual(JSON.parse(JSON.stringify(req)));
    }), runs(300));
  }, timeoutFor(300, 1));

  it('refuse one with a field broken, naming the field', () => {
    fc.assert(fc.property(broken, ({ req, field }) => {
      expect(() => readPageRequest(req)).toThrow(new RegExp(`headless render request: ${field}\\b`));
    }), runs(300));
  }, timeoutFor(300, 1));

  it('read or refuse any JSON with a documented error, never a TypeError', () => {
    let read = 0;
    let refused = 0;
    const anyRequest = fc.oneof(
      fc.jsonValue({ maxDepth: 3 }),
      fc.record({
        scene: fc.jsonValue({ maxDepth: 1 }), sourceRect: fc.jsonValue({ maxDepth: 1 }),
        scale: fc.jsonValue({ maxDepth: 1 }), format: fc.jsonValue({ maxDepth: 0 }),
      }, { requiredKeys: [] }),
      request.map((r) => JSON.parse(JSON.stringify(r)) as unknown),
    );
    fc.assert(fc.property(anyRequest, (value) => {
      try {
        readPageRequest(value);
        read++;
      } catch (e) {
        refused++;
        expect(e).not.toBeInstanceOf(TypeError);
        expect(String(e)).toMatch(/^Error: headless render request: /);
      }
    }), runs(500));
    expect(read).toBeGreaterThan(50);
    expect(refused).toBeGreaterThan(50);
  }, timeoutFor(500, 1));
});

describe('shrunk counterexamples', () => {
  it('sends a non-finite float and -0 as themselves, where JSON alone would write null and 0', () => {
    const back = sceneFromWire(JSON.parse(JSON.stringify(sceneToWire({ c: Float32Array.of(Infinity, Number.NaN, -Infinity, -0) }))) as object);
    expect(Array.from((back as { c: Float32Array }).c)).toEqual([Infinity, Number.NaN, -Infinity, -0]);
  });

  it('refuses a scene that is not an object before reading it', () => {
    expect(() => sceneToWire(undefined as never)).toThrow(/headless render request: scene must be an object/);
  });
});
