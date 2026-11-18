import { useMemo, useState, useSyncExternalStore } from 'react';
import { SceneCanvas, useScene, circlePath, polylineFromPoints, rectPath, worldPoses } from '@weasel-js/core';
import type { NodeId, RenderLayer, Scene } from '@weasel-js/core';
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
import { Field } from '@weasel-js/ui/components/Field';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import s from './GeomDemo.module.css';
import { DemoStage } from './DemoStage';
import { decimal, qty } from '@weasel-js/quantity';
import { movePreset, pickPreset } from '@weasel-js/editing';

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
    { kind: 'path', path: circlePath(m.near.x, m.near.y, 4), fill: { paint: PROBE } },
    { kind: 'path', path: circlePath(m.before[6], m.before[7], 5), fill: { paint: AT_T } },
  ];
}

/** Each dot's center as shown, a drag's in-flight pose included. */
function centersOf<L extends string>(scene: Scene<Dot, L, Dot>) {
  const world = worldPoses(scene);
  const out = new Map<string, { x: number; y: number }>();
  for (const d of INITIAL) {
    const p = world(d.id as NodeId);
    out.set(d.id, { x: p.x + p.width / 2, y: p.y + p.height / 2 });
  }
  return out;
}

/** A dot drawn where its pose puts it: a move writes the pose, never the data. */
export function drawDot(role: Role, p: { x: number; y: number }): DrawCommand[] {
  const circle = circlePath(p.x + R, p.y + R, R - 1);
  if (role === 'anchor') return [{ kind: 'path', path: circle, fill: { paint: INK } }];
  if (role === 'probe') return [{ kind: 'path', path: circle, fill: { paint: PROBE } }];
  return [{ kind: 'path', path: circle, fill: { paint: { color: '#ffffff' } }, stroke: { paint: INK, width: { px: 1.5 } } }];
}

const fmt = (n: number, w = 6, p = 1) => qty(n, decimal({ places: p, grouping: false })).text.padStart(w, '\u2007');

export function GeomDemo() {
  const [t, setT] = useState(0.5);
  const scene = useScene<Dot>({ items: INITIAL });
  // A drag previews through the scene's pose overrides, so the table follows it before it commits.
  useSyncExternalStore(scene.overrides.subscribe, scene.overrides.getGeneration);

  const m = measure(centersOf(scene), t);

  const curveLayer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'curve',
    label: 'Curve',
    draw: () => {
      const c = centersOf(scene);
      return drawMeasure(measure(c, t), c.get('probe')!);
    },
  }), [scene, t]);

  return (
    <div className={s.demo}>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={[pickPreset, movePreset]}
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          layers={{
            scene: {
              drawOne: (n, p) => drawDot(n.data.role, p),
            },
            curve: { layer: curveLayer, before: 'scene' },
          }}
        />
      </DemoStage>
      <Field orientation="row" className={s.control} label={<><code>splitCubicAt</code> t</>} output={t.toFixed(2)}>
        <InlineRange
          min={0} max={1} step={0.01} value={t}
          className={s.slider}
          data-testid="t"
          onChange={(e) => setT(Number(e.target.value))}
        />
      </Field>
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
            <td className={s.num}>{fmt(m.near.distance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
