/**
 * Property tests of `composeOrderedLayers` over generated layer maps: customs anchored after or before a
 * standard slot, a split scene's layers, each other, a key nothing defines, or nothing, with chains, cycles,
 * empty anchors, and keys named like `Object.prototype` members. Checked against the anchor graph itself: every
 * layer once, each placed custom beside its anchor in one unbroken run with everything anchored to it, the
 * unplaceable last in map order, each with one warning naming its cycle or the key its chain ends on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { RenderLayer } from '../core/layers/render';
import { composeOrderedLayers, placeToolOverlays } from './layerOrder';
import { STANDARD_SLOTS } from './layerSlots';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const L = (id: string): RenderLayer<unknown> => ({ id, label: id, space: 'screen', draw: () => [] });

const CUSTOM_KEYS = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', '__proto__', 'constructor', 'toString'] as const;
const SCENE_KEYS = ['scene:s0', 'scene:s1', 'scene:s2'] as const;
const TARGETS = [...STANDARD_SLOTS, ...SCENE_KEYS, ...CUSTOM_KEYS, 'ghost', 'hasOwnProperty', ''] as const;

interface Custom { key: string; after?: string; before?: string }
interface Case {
  customs: Custom[];
  standard: Partial<Record<(typeof STANDARD_SLOTS)[number], boolean>>;
  sceneKeys: string[] | null;
  background: boolean;
}

const target = fc.constantFrom(...TARGETS);
const caseArb: fc.Arbitrary<Case> = fc.record({
  customs: fc.uniqueArray(fc.record({
    key: fc.constantFrom(...CUSTOM_KEYS),
    anchor: fc.constantFrom('none', 'after', 'before', 'both'),
    a: target,
    b: target,
  }), { selector: (c) => c.key, maxLength: CUSTOM_KEYS.length }).map((cs) => cs.map(({ key, anchor, a, b }): Custom => ({
    key,
    ...(anchor === 'after' || anchor === 'both' ? { after: a } : {}),
    ...(anchor === 'before' ? { before: a } : anchor === 'both' ? { before: b } : {}),
  }))),
  standard: fc.record(Object.fromEntries(STANDARD_SLOTS.map((s) => [s, fc.boolean()])) as Record<(typeof STANDARD_SLOTS)[number], fc.Arbitrary<boolean>>),
  sceneKeys: fc.option(fc.subarray([...SCENE_KEYS]), { nil: null }),
  background: fc.boolean(),
});

/** The map as a caller would hand it: every key an own property, `__proto__` included. */
function mapOf(c: Case): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const x of c.customs) {
    Object.defineProperty(map, x.key, {
      value: { layer: L(x.key), ...(x.after !== undefined ? { after: x.after } : {}), ...(x.before !== undefined ? { before: x.before } : {}) },
      enumerable: true, writable: true, configurable: true,
    });
  }
  return map;
}

/** A custom's anchor, as the composer places it: `after` when it names one, else `before`. */
const anchorOf = (x: Custom): { side: 'after' | 'before'; to: string } | null =>
  x.after ? { side: 'after', to: x.after } : x.before ? { side: 'before', to: x.before } : null;

type Fate = { placed: true } | { placed: false; cycle: boolean; end: string };

/** Whether the chain of anchors from `key` reaches the stack, loops, or ends on a key nothing defines. */
function fateOf(c: Case, key: string): Fate {
  const byKey = new Map(c.customs.map((x) => [x.key, x]));
  const roots = new Set<string>([...STANDARD_SLOTS, ...(c.sceneKeys ?? [])]);
  const seen = new Set<string>();
  for (let at = key; ;) {
    if (seen.has(at)) return { placed: false, cycle: true, end: at };
    seen.add(at);
    const a = anchorOf(byKey.get(at)!);
    if (a === null || roots.has(a.to)) return { placed: true };
    if (!byKey.has(a.to)) return { placed: false, cycle: false, end: a.to };
    at = a.to;
  }
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockRestore(); });

describe('composeOrderedLayers against the anchor graph', () => {
  it('places every layer once, each custom beside its anchor, the unplaceable last with one warning each', () => {
    const tally = { placed: 0, chained: 0, cycle: 0, dangling: 0, chainedDangling: 0, offCycle: 0 };
    fc.assert(fc.property(caseArb, (c) => {
      warn.mockClear();
      const standardLayers = Object.fromEntries(STANDARD_SLOTS.filter((s) => c.standard[s]).map((s) => [s, L(`std:${s}`)]));
      const sceneLayers = c.sceneKeys?.map((key) => ({ key, layer: L(key) }));
      const out = composeOrderedLayers(mapOf(c), standardLayers, sceneLayers, c.background ? L('background') : undefined)
        .map((l) => l.id);

      const expected = [
        ...(c.background ? ['background'] : []),
        ...STANDARD_SLOTS.filter((s) => c.standard[s] && !(s === 'scene' && sceneLayers)).map((s) => `std:${s}`),
        ...(c.sceneKeys ?? []),
        ...c.customs.map((x) => x.key),
      ];
      expect([...out].sort()).toEqual([...expected].sort());
      if (c.background) expect(out[0]).toBe('background');

      // The stack's own layers keep their order, a split scene's in the scene slot.
      const stack = STANDARD_SLOTS.flatMap((s) => (s === 'scene' && sceneLayers ? c.sceneKeys! : c.standard[s] ? [`std:${s}`] : []));
      expect(out.filter((id) => stack.includes(id))).toEqual(stack);

      const fates = new Map(c.customs.map((x) => [x.key, fateOf(c, x.key)]));
      const orphans = c.customs.filter((x) => !fates.get(x.key)!.placed).map((x) => x.key);
      expect(out.slice(out.length - orphans.length)).toEqual(orphans);

      const at = (id: string) => out.indexOf(id);
      const idOf = (key: string): string | null => {
        if ((STANDARD_SLOTS as readonly string[]).includes(key)) return c.standard[key as 'grid'] && !(key === 'scene' && sceneLayers) ? `std:${key}` : null;
        return out.includes(key) ? key : null;
      };
      const placedCustoms = c.customs.filter((x) => fates.get(x.key)!.placed);
      // Everything anchored to `key`, at any depth.
      const under = (key: string): string[] => placedCustoms.filter((x) => anchorOf(x)?.to === key)
        .flatMap((x) => [x.key, ...under(x.key)]);
      const lastStack = Math.max(-1, ...stack.map(at));
      for (const x of placedCustoms) {
        tally.placed++;
        const a = anchorOf(x);
        if (a === null) {
          // Unanchored customs follow the whole stack.
          expect(at(x.key)).toBeGreaterThan(lastStack);
        } else {
          const anchor = idOf(a.to);
          if (anchor !== null) {
            if (a.side === 'after') expect(at(x.key)).toBeGreaterThan(at(anchor));
            else expect(at(x.key)).toBeLessThan(at(anchor));
          }
          if (!(STANDARD_SLOTS as readonly string[]).includes(a.to) && !(SCENE_KEYS as readonly string[]).includes(a.to)) tally.chained++;
        }
        // A custom and everything hanging off it form one unbroken run.
        const run = [x.key, ...under(x.key)].map(at).sort((p, q) => p - q);
        expect(run.at(-1)! - run[0]!).toBe(run.length - 1);
      }

      // One warning per orphan, saying whether its chain loops and, if not, which key it ends on.
      expect(warn).toHaveBeenCalledTimes(orphans.length);
      orphans.forEach((key, i) => {
        const fate = fates.get(key)! as Extract<Fate, { placed: false }>;
        const msg = String(warn.mock.calls[i]![0]);
        expect(msg).toContain(`"${key}"`);
        if (fate.cycle) {
          tally.cycle++;
          expect(msg).toContain('cycle');
          if (fate.end !== key) tally.offCycle++;
        } else {
          tally.dangling++;
          expect(msg).toContain(`dangling reference "${fate.end}"`);
          if (anchorOf(c.customs.find((x) => x.key === key)!)!.to !== fate.end) tally.chainedDangling++;
        }
      });
    }), runs(RUNS));
    expect(tally.placed).toBeGreaterThan(300);
    expect(tally.chained).toBeGreaterThan(60);
    expect(tally.cycle).toBeGreaterThan(30);
    expect(tally.dangling).toBeGreaterThan(30);
    expect(tally.chainedDangling).toBeGreaterThan(10);
    expect(tally.offCycle).toBeGreaterThan(10);
  }, timeoutFor(RUNS, 5));
});

describe('placeToolOverlays', () => {
  it('splices before- and after-selection overlays around the selection overlay, top ones last', () => {
    let anchored = 0;
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }), fc.option(fc.nat(), { nil: null }),
      fc.nat(3), fc.nat(3), fc.nat(3),
      (n, selAt, nb, na, nt) => {
        const base = Array.from({ length: n }, (_, i) => L(`b${i}`));
        const sel = selAt === null || n === 0 ? undefined : base[selAt % n];
        const made = (p: string, k: number) => Array.from({ length: k }, (_, i) => L(`${p}${i}`));
        const lists = { 'before-selection': made('pre', nb), 'after-selection': made('post', na), top: made('top', nt) };
        const out = placeToolOverlays([...base], sel, (p) => lists[p]).map((l) => l.id);
        const ids = (ls: RenderLayer<unknown>[]) => ls.map((l) => l.id);
        if (sel) {
          anchored++;
          const i = base.indexOf(sel);
          expect(out).toEqual([
            ...ids(base.slice(0, i)), ...ids(lists['before-selection']), sel.id, ...ids(lists['after-selection']),
            ...ids(base.slice(i + 1)), ...ids(lists.top),
          ]);
        } else {
          expect(out).toEqual([...ids(base), ...ids(lists['before-selection']), ...ids(lists['after-selection']), ...ids(lists.top)]);
        }
      },
    ), runs(RUNS));
    expect(anchored).toBeGreaterThan(RUNS / 4);
  }, timeoutFor(RUNS, 2));
});
