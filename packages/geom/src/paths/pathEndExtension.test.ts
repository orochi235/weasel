import { describe, expect, it } from 'vitest';
import type { Point } from './cubicMath';
import { cubicCurvatureAt, cubicDerivativeAt } from './curvature';
import { nearestOnCubic, nearestOnLine } from '../nearest';
import { easeLength, extensionPieces, type ExtensionPiece, type PathEndFrame } from './pathEndExtension';

const frame: PathEndFrame = { point: { x: 10, y: 20 }, tangent: { x: 0.6, y: 0.8 }, curvature: 1 / 40 };
const angleOf = (v: Point) => Math.atan2(v.y, v.x);
const unit = (v: Point) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };

function startTangent(p: ExtensionPiece): Point {
  const [a, b, c, d] = p.pts;
  return unit(p.pts.length === 2 ? { x: b.x - a.x, y: b.y - a.y } : cubicDerivativeAt(a, b, c, d, 0));
}
function endTangent(p: ExtensionPiece): Point {
  const [a, b, c, d] = p.pts;
  return unit(p.pts.length === 2 ? { x: b.x - a.x, y: b.y - a.y } : cubicDerivativeAt(a, b, c, d, 1));
}
const curvatureAt = (p: ExtensionPiece, t: number) =>
  (p.pts.length === 2 ? 0 : cubicCurvatureAt(p.pts[0], p.pts[1], p.pts[2], p.pts[3], t));

/** The eased curve by brute force: the end's curvature falling linearly to zero over `ease`, then straight. */
function easedTruth(f: PathEndFrame, ease: number, distance: number, steps = 20000): Point[] {
  const out: Point[] = [f.point];
  let { x, y } = f.point;
  let a = angleOf(f.tangent);
  const h = distance / steps;
  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) * h;
    const k = s < ease ? f.curvature * (1 - s / ease) : 0;
    const am = a + (k * h) / 2;
    x += Math.cos(am) * h;
    y += Math.sin(am) * h;
    a += k * h;
    out.push({ x, y });
  }
  return out;
}

function distanceToPieces(q: Point, pieces: ExtensionPiece[]): number {
  return Math.min(...pieces.map(({ pts: [a, b, c, d] }) => (d
    ? nearestOnCubic(q.x, q.y, a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y).dist
    : nearestOnLine(q.x, q.y, a.x, a.y, b.x, b.y).dist)));
}

describe("extensionPieces in 'eased' mode", () => {
  const ease = easeLength(frame);
  const pieces = extensionPieces(frame, ease + 30, 'eased');
  const last = pieces[pieces.length - 1];

  it('eases over the length that turns 30°, then runs straight', () => {
    expect(ease).toBeCloseTo((2 * (Math.PI / 6)) / frame.curvature, 9);
    expect(last.pts).toHaveLength(2);
    expect(last.length).toBeCloseTo(30, 9);
    expect(angleOf(startTangent(last)) - angleOf(frame.tangent)).toBeCloseTo(Math.PI / 6, 9);
    expect(pieces.reduce((n, p) => n + p.length, 0)).toBeCloseTo(ease + 30, 9);
  });

  it("leaves the end with its tangent and curvature (G2)", () => {
    const first = pieces[0];
    expect(first.pts[0]).toEqual(frame.point);
    expect(startTangent(first).x).toBeCloseTo(frame.tangent.x, 9);
    expect(startTangent(first).y).toBeCloseTo(frame.tangent.y, 9);
    expect(curvatureAt(first, 0)).toBeCloseTo(frame.curvature, 7);
  });

  it('keeps tangent and curvature continuous between its pieces, reaching zero curvature at the straight run', () => {
    for (let i = 1; i < pieces.length; i++) {
      const a = pieces[i - 1], b = pieces[i];
      expect(b.pts[0]).toEqual(a.pts[a.pts.length - 1]);
      expect(angleOf(startTangent(b))).toBeCloseTo(angleOf(endTangent(a)), 9);
      expect(curvatureAt(b, 0)).toBeCloseTo(curvatureAt(a, 1), 7);
    }
    expect(curvatureAt(pieces[pieces.length - 2], 1)).toBeCloseTo(0, 9);
  });

  it('stays within a hair of the true spiral', () => {
    const truth = easedTruth(frame, ease, ease + 30);
    const worst = Math.max(...truth.filter((_, i) => i % 200 === 0).map((q) => distanceToPieces(q, pieces)));
    expect(worst).toBeLessThan(0.01);
  });

  it('stops partway along the same spiral for a distance shorter than the ease', () => {
    const short = extensionPieces(frame, ease / 2, 'eased');
    expect(short.every((p) => p.pts.length === 4)).toBe(true);
    expect(short.reduce((n, p) => n + p.length, 0)).toBeCloseTo(ease / 2, 9);
    const tip = short[short.length - 1].pts[3];
    expect(distanceToPieces(tip, pieces)).toBeLessThan(1e-3);
    expect(curvatureAt(short[short.length - 1], 1)).toBeCloseTo(frame.curvature / 2, 6);
  });

  it('turns by the cap it is given, at most a quarter turn', () => {
    const turnOf = (easeTurn: number) => {
      const p = extensionPieces(frame, easeLength(frame, { easeTurn }) + 1, 'eased', { easeTurn });
      return angleOf(startTangent(p[p.length - 1])) - angleOf(frame.tangent);
    };
    expect(turnOf(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 9);
    expect(turnOf(Math.PI)).toBeCloseTo(Math.PI / 2, 9);
  });

  it('bends the other way for a negative curvature', () => {
    const p = extensionPieces({ ...frame, curvature: -frame.curvature }, ease + 1, 'eased');
    expect(angleOf(startTangent(p[p.length - 1])) - angleOf(frame.tangent)).toBeCloseTo(-Math.PI / 6, 9);
  });

  it("is the 'tangent' line on a straight end", () => {
    const straight = { ...frame, curvature: 0 };
    expect(extensionPieces(straight, 25, 'eased')).toEqual(extensionPieces(straight, 25, 'tangent'));
  });
});
