import { describe, expect, it } from 'vitest';
import { multiply, rotate, translate, type Affine } from '../affine';
import { anchorAt, anchorCount, type AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import { anchorSymmetries, moveHandleSymmetric, translateAnchorsSymmetric } from './anchorSymmetry';

const C = { x: 100, y: 100 };
const about = (m: Affine): Affine => multiply(translate(C.x, C.y), multiply(m, translate(-C.x, -C.y)));
const turn = (k: number, n: number): Affine => about(rotate((2 * Math.PI * k) / n));
const mirror = (angle: number): Affine => {
  const c = Math.cos(2 * angle);
  const s = Math.sin(2 * angle);
  return about([c, s, s, -c, 0, 0]);
};

/** The cyclic group of order n, less the identity. */
const cyclic = (n: number) => Array.from({ length: n - 1 }, (_, k) => turn(k + 1, n));
/** The dihedral group of order 2n, less the identity: n turns and n mirrors. */
const dihedral = (n: number) => [...cyclic(n), ...Array.from({ length: n }, (_, k) => mirror((Math.PI * k) / n))];

/** `seed`, and its image under every element of `group`, as one closed path. */
function orbitPath(seed: PenAnchor[], group: readonly Affine[]): AnchorSet {
  const app = (m: Affine, p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
  const all: PenAnchor[] = [];
  // The turns, in order round the center, so the path closes on itself.
  const n = group.filter((m) => m[0] * m[3] - m[1] * m[2] > 0).length + 1;
  for (let k = 0; k < n; k++) {
    const m = turn(k, n);
    for (const a of seed) {
      all.push({
        ...app(m, a),
        ...(a.inHandle ? { inHandle: app(m, a.inHandle) } : {}),
        ...(a.outHandle ? { outHandle: app(m, a.outHandle) } : {}),
      });
    }
  }
  return { anchors: [all], closed: [true] };
}

const clone = (s: AnchorSet): AnchorSet => structuredClone(s);
const TOL = 1e-6;

/** For a dihedral orbit, a seed symmetric about the wedge's first mirror (the x axis through C):
 *  an anchor on that axis, smooth with a vertical tangent, and one off it. */
const dihedralSeed = (n: number): PenAnchor[] => {
  const r = 60;
  const a = Math.PI / n;
  const mid = { x: C.x + 0.55 * r * Math.cos(a), y: C.y + 0.55 * r * Math.sin(a) };
  return [
    { x: C.x + r, y: C.y, inHandle: { x: C.x + r, y: C.y - 12 }, outHandle: { x: C.x + r, y: C.y + 12 } },
    { ...mid, inHandle: { x: mid.x + 8, y: mid.y - 5 }, outHandle: { x: mid.x - 8, y: mid.y + 5 } },
  ];
};

/** Mirror the off-axis anchor of a dihedral seed so the orbit has both reflections in it. */
function dihedralPath(n: number): AnchorSet {
  const [onAxis, off] = dihedralSeed(n);
  const m = mirror(Math.PI / n);
  const app = (p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
  const twin: PenAnchor = { ...app(off), inHandle: app(off.outHandle!), outHandle: app(off.inHandle!) };
  const onSecondAxis: PenAnchor = (() => {
    const r = 40;
    const ang = Math.PI / n;
    const p = { x: C.x + r * Math.cos(ang), y: C.y + r * Math.sin(ang) };
    const t = { x: -Math.sin(ang) * 6, y: Math.cos(ang) * 6 };
    return { ...p, inHandle: { x: p.x - t.x, y: p.y - t.y }, outHandle: { x: p.x + t.x, y: p.y + t.y } };
  })();
  return orbitPath([onAxis, off, onSecondAxis, twin], cyclic(n));
}

const cases: Array<{ name: string; set: () => AnchorSet; group: Affine[] }> = [
  { name: 'both axes (D2)', set: () => dihedralPath(2), group: dihedral(2) },
  { name: 'kaleidoscope of 3 (D3)', set: () => dihedralPath(3), group: dihedral(3) },
  { name: 'kaleidoscope of 4 (D4)', set: () => dihedralPath(4), group: dihedral(4) },
  {
    name: 'radial of 3 (C3)',
    set: () => orbitPath([
      { x: 160, y: 100, inHandle: { x: 165, y: 85 }, outHandle: { x: 155, y: 115 } },
      { x: 120, y: 130, inHandle: { x: 130, y: 128 }, outHandle: { x: 112, y: 134 } },
    ], cyclic(3)),
    group: cyclic(3),
  },
];

const DELTAS = [{ x: 7, y: -3 }, { x: -11, y: 4 }, { x: 0.5, y: 9 }];

describe.each(cases)('$name', ({ set, group }) => {
  it('starts symmetric under the whole group', () => {
    expect(anchorSymmetries(set(), group, TOL)).toHaveLength(group.length);
  });

  it('stays symmetric when any anchor is dragged', () => {
    const base = set();
    const syms = anchorSymmetries(base, group, TOL);
    for (let i = 0; i < anchorCount(base); i++) {
      for (const d of DELTAS) {
        const s = clone(base);
        translateAnchorsSymmetric(s, [i], d.x, d.y, syms);
        expect(anchorSymmetries(s, group, 1e-6), `anchor ${i} by ${d.x},${d.y}`).toHaveLength(group.length);
      }
    }
  });

  it('stays symmetric when any handle is dragged, smooth or broken', () => {
    const base = set();
    const syms = anchorSymmetries(base, group, TOL);
    for (let i = 0; i < anchorCount(base); i++) {
      for (const side of ['in', 'out'] as const) {
        const h = side === 'in' ? anchorAt(base, i)!.inHandle! : anchorAt(base, i)!.outHandle!;
        for (const d of DELTAS) {
          for (const brk of [false, true]) {
            const s = clone(base);
            moveHandleSymmetric(s, i, side, h.x + d.x, h.y + d.y, brk, syms);
            expect(anchorSymmetries(s, group, 1e-6), `anchor ${i} ${side} by ${d.x},${d.y} break=${brk}`)
              .toHaveLength(group.length);
          }
        }
      }
    }
  });

  it('moves a dragged off-axis anchor exactly as dragged', () => {
    const base = set();
    const syms = anchorSymmetries(base, group, TOL);
    const i = 1;
    const before = anchorAt(base, i)!;
    const s = clone(base);
    translateAnchorsSymmetric(s, [i], 5, 5, syms);
    expect(anchorAt(s, i)!.x).toBeCloseTo(before.x + 5);
    expect(anchorAt(s, i)!.y).toBeCloseTo(before.y + 5);
  });
});
