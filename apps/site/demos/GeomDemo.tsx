import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SceneCanvas, useScene, circlePath, polylineFromPoints, rectPath } from '@weasel-js/core';
import type { CanvasHelpers, RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import {
  boundsOfCoords,
  cubicBounds,
  flattenCubicWithArcLen,
  nearestOnCubic,
  splitCubicAt,
  type Box,
  type CubicCoords,
  type CurveNearest,
} from '@weasel-js/geom';
import s from './GeomDemo.module.css';
import { decimal, qty } from '@weasel-js/quantity';

const W = 620, H = 360;
const R = 7;

type Role = 'anchor' | 'control' | 'probe';
interface Dot { id: string; role: Role; x: number; y: number; width: number; height: number }

const node = (id: string, role: Role, cx: number, cy: number): Dot =>
  ({ id, role, x: cx - R, y: cy - R, width: R * 2, height: R * 2 });

const INITIAL: Dot[] = [
  node('p0', 'anchor', 90, 270),
  node('p1', 'control', 170, 40),
  node('p2', 'control', 470, 330),
  node('p3', 'anchor', 540, 90),
  node('probe', 'probe', 330, 110),
];
const CURVE_IDS = ['p0', 'p1', 'p2', 'p3'] as const;

const INK = { color: '#1a1a1a' };
const MUTED = { color: '#9a9a9a' };
const TIGHT = { color: '#2f7fd0' };
const PROBE = { color: '#c0392b' };
const AT_T = { color: '#e08a1e' };

interface Measure {
  c: CubicCoords;
  hull: Box;
  tight: Box;
  /** Flattened curve, starting vertex included. */
  line: number[];
  length: number;
  /** The curve up to t, as a cubic of its own, and that cubic flattened. */
  before: CubicCoords;
  beforeLine: number[];
  beforeLength: number;
  near: CurveNearest;
}

const flatten = (c: CubicCoords) => {
  const line = [c[0], c[1]];
  const length = flattenCubicWithArcLen(...c, 0.25, line, [0]);
  return { line, length };
};

function measure(centers: Map<string, { x: number; y: number }>, t: number): Measure {
  const [a, b, c, d] = CURVE_IDS.map((id) => centers.get(id)!);
  const probe = centers.get('probe')!;
  const cs: CubicCoords = [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
  const whole = flatten(cs);
  const [before] = splitCubicAt(...cs, t);
  const part = flatten(before);

  return {
    c: cs,
    hull: boundsOfCoords(cs)!,
    tight: cubicBounds(...cs),
    line: whole.line,
    length: whole.length,
    before,
    beforeLine: part.line,
    beforeLength: part.length,
    near: nearestOnCubic(probe.x, probe.y, ...cs),
  };
}

const boxPath = (b: Box) => rectPath(b[0], b[1], b[2] - b[0], b[3] - b[1]);
const pts = (flat: number[]) => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
};

function drawMeasure(m: Measure, probe: { x: number; y: number }): DrawCommand[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = m.c;
  const thin = (paint: { color: string }, dash?: number[]) => ({ paint, width: { px: 1 }, dash });
  return [
    { kind: 'path', path: boxPath(m.hull), stroke: thin(MUTED, [4, 4]) },
    { kind: 'path', path: boxPath(m.tight), stroke: thin(TIGHT) },
    { kind: 'path', path: polylineFromPoints([{ x: x0, y: y0 }, { x: x1, y: y1 }]), stroke: thin(MUTED) },
    { kind: 'path', path: polylineFromPoints([{ x: x3, y: y3 }, { x: x2, y: y2 }]), stroke: thin(MUTED) },
    { kind: 'path', path: polylineFromPoints(pts(m.line)), stroke: { paint: INK, width: { px: 2.5 } } },
    { kind: 'path', path: polylineFromPoints(pts(m.before)), stroke: thin(AT_T, [4, 3]) },
    { kind: 'path', path: polylineFromPoints(pts(m.beforeLine)), stroke: { paint: AT_T, width: { px: 2.5 } } },
    { kind: 'path', path: polylineFromPoints([probe, m.near]), stroke: thin(PROBE, [3, 3]) },
    { kind: 'path', path: circlePath(m.near.x, m.near.y, 4), fill: PROBE },
    { kind: 'path', path: circlePath(m.before[6], m.before[7], 5), fill: AT_T },
  ];
}

function centersOf(helpers: CanvasHelpers<Dot> | null, scene: { get(id: never): { data: Dot } | undefined }) {
  const out = new Map<string, { x: number; y: number }>();
  for (const d of INITIAL) {
    const p = helpers?.getEffectivePose(d.id) ?? scene.get(d.id as never)?.data ?? d;
    out.set(d.id, { x: p.x + p.width / 2, y: p.y + p.height / 2 });
  }
  return out;
}

const fmt = (n: number, w = 6, p = 1) => qty(n, decimal({ places: p, grouping: false })).text.padStart(w, '\u2007');

/**
 * A cubic Bézier and what `@weasel-js/geom` computes about it. The four
 * control points and the probe are ordinary scene nodes the kit's move tool
 * drags; the overlay reads their live poses through `helpersRef`, so every
 * number follows the drag rather than waiting for it to commit.
 */
export function GeomDemo() {
  const [t, setT] = useState(0.5);
  const scene = useScene<Dot>({ items: INITIAL });
  const helpersRef = useRef<CanvasHelpers<Dot> | null>(null);

  useSyncExternalStore(
    useCallback((cb: () => void) => helpersRef.current?.subscribeGestures(cb) ?? (() => {}), []),
    () => helpersRef.current?.getGestureVersion() ?? 0,
  );

  const m = measure(centersOf(helpersRef.current, scene), t);

  const curveLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'curve',
    label: 'Curve',
    draw: () => {
      const c = centersOf(helpersRef.current, scene);
      return drawMeasure(measure(c, t), c.get('probe')!);
    },
  }), [scene, t]);

  return (
    <div className={s.demo}>
      <SceneCanvas
        features={['pick', 'move']}
        width={W}
        height={H}
        className="ckd-canvas"
        backgroundFill={{ color: '#ffffff' }}
        scene={scene}
        helpersRef={helpersRef}
        layers={{
          scene: {
            drawOne: (n): DrawCommand[] => {
              const d = n.data;
              const circle = circlePath(d.x + R, d.y + R, R - 1);
              if (d.role === 'anchor') return [{ kind: 'path', path: circle, fill: INK }];
              if (d.role === 'probe') return [{ kind: 'path', path: circle, fill: PROBE }];
              return [{ kind: 'path', path: circle, fill: { color: '#ffffff' }, stroke: { paint: INK, width: { px: 1.5 } } }];
            },
          },
          curve: { layer: curveLayer, before: 'scene' },
        }}
      />
      <label className={s.control}>
        <span><code>splitCubicAt</code> t</span>
        <input
          type="range" min={0} max={1} step={0.01} value={t}
          className={s.slider}
          data-testid="t"
          onChange={(e) => setT(Number(e.target.value))}
        />
        <span className={s.readout}>{t.toFixed(2)}</span>
      </label>
      <table className={s.table}>
        <tbody>
          <tr>
            <td className={s.fn}><span className={s.swatchHull} />boundsOfCoords</td>
            <td>box around the control points</td>
            <td className={s.num}>{fmt(m.hull[2] - m.hull[0])} × {fmt(m.hull[3] - m.hull[1])}</td>
          </tr>
          <tr>
            <td className={s.fn}><span className={s.swatchTight} />cubicBounds</td>
            <td>box around the curve itself</td>
            <td className={s.num}>{fmt(m.tight[2] - m.tight[0])} × {fmt(m.tight[3] - m.tight[1])}</td>
          </tr>
          <tr>
            <td className={s.fn}>flattenCubicWithArcLen</td>
            <td>length of the curve</td>
            <td className={s.num}>{fmt(m.length)}</td>
          </tr>
          <tr>
            <td className={s.fn}><span className={s.swatchT} />splitCubicAt</td>
            <td>share of the length in the curve up to t, split off as a cubic of its own</td>
            <td className={s.num}>{fmt((100 * m.beforeLength) / m.length)}%</td>
          </tr>
          <tr>
            <td className={s.fn}><span className={s.swatchProbe} />nearestOnCubic</td>
            <td>probe to the nearest point on the curve, at t = {m.near.t.toFixed(2)}</td>
            <td className={s.num}>{fmt(m.near.dist)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
