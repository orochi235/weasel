import { describe, expect, test } from 'vitest';
import { MARK_COLOR } from '../paint';
import type { Annotation, AnnotationKind } from '../types';
import { CALIBRATION_BLUE, CONTENT, EXERCISES, type Exercise, type Pt } from './exercises';
import {
  boxError,
  curveError,
  distanceToCurve,
  scoreAll,
  scoreExercise,
  segmentError,
  toScreenPx,
} from './score';

const W = CONTENT.w;
const H = CONTENT.h;

function exercise(id: string): Exercise {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`no exercise ${id}`);
  return ex;
}

let n = 0;
/** A mark as the store reports one, from a box and points in content units. */
function mark(
  kind: AnnotationKind,
  box: { x: number; y: number; w: number; h: number },
  points?: readonly Pt[],
  extra: Partial<Annotation> = {},
): Annotation {
  n += 1;
  return {
    id: `pane/${n}`,
    target: 'pane',
    kind,
    frac: { x: box.x / W, y: box.y / H, w: box.w / W, h: box.h / H },
    ...(points ? { points: points.map((p) => ({ x: p.x / W, y: p.y / H })) } : {}),
    ...extra,
  };
}

const boxOf = (ex: Exercise) => {
  if (ex.guide.kind !== 'box') throw new Error('not a box guide');
  return ex.guide.box;
};
const segOf = (ex: Exercise) => {
  if (ex.guide.kind !== 'segment') throw new Error('not a segment guide');
  return ex.guide;
};
const curveOf = (ex: Exercise) => {
  if (ex.guide.kind !== 'curve') throw new Error('not a curve guide');
  return ex.guide.points;
};
const lineMark = (kind: AnnotationKind, a: Pt, b: Pt, extra?: Partial<Annotation>) =>
  mark(
    kind,
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
    },
    [a, b],
    extra,
  );
const shift = (p: Pt, dx: number, dy = 0): Pt => ({ x: p.x + dx, y: p.y + dy });

describe('exercises', () => {
  test('every guide lies inside its own cell, and no two cells overlap', () => {
    for (const ex of EXERCISES) {
      const a = ex.area;
      expect(a.x + a.w).toBeLessThanOrEqual(W);
      expect(a.y + a.h).toBeLessThanOrEqual(H);
      const pts: Pt[] =
        ex.guide.kind === 'box'
          ? [
              ex.guide.box,
              { x: ex.guide.box.x + ex.guide.box.w, y: ex.guide.box.y + ex.guide.box.h },
            ]
          : ex.guide.kind === 'segment'
            ? [ex.guide.a, ex.guide.b]
            : [...ex.guide.points];
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(a.x);
        expect(p.x).toBeLessThanOrEqual(a.x + a.w);
        expect(p.y).toBeGreaterThanOrEqual(a.y);
        expect(p.y).toBeLessThanOrEqual(a.y + a.h);
      }
    }
    for (const [i, a] of EXERCISES.entries()) {
      for (const b of EXERCISES.slice(i + 1)) {
        const apart =
          a.area.x + a.area.w <= b.area.x ||
          b.area.x + b.area.w <= a.area.x ||
          a.area.y + a.area.h <= b.area.y ||
          b.area.y + b.area.h <= a.area.y;
        expect(apart, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  test('ids are unique', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe('measures', () => {
  test('boxError is the worst edge', () => {
    expect(boxError({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
    expect(boxError({ x: 1, y: 0, w: 9, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(1);
    expect(boxError({ x: 0, y: 0, w: 13, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(3);
    expect(boxError({ x: -2, y: 0, w: 14, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(2);
  });

  test('segmentError pairs the ends as given', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(segmentError(a, b, a, b)).toBe(0);
    expect(segmentError(b, a, a, b)).toBe(10);
    expect(segmentError(a, { x: 10, y: 4 }, a, b)).toBe(4);
  });

  test('distanceToCurve measures to the polyline, not only its vertices', () => {
    const curve = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(distanceToCurve({ x: 5, y: 3 }, curve)).toBeCloseTo(3);
    expect(distanceToCurve({ x: -4, y: 3 }, curve)).toBeCloseTo(5);
    expect(distanceToCurve({ x: 1, y: 1 }, [{ x: 1, y: 2 }])).toBe(1);
  });

  test('curveError reports mean and max', () => {
    const curve = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const e = curveError(
      [
        { x: 1, y: 0 },
        { x: 2, y: 1 },
        { x: 3, y: -3 },
      ],
      curve,
    );
    expect(e.mean).toBeCloseTo(4 / 3);
    expect(e.max).toBeCloseTo(3);
    expect(curveError([], curve).mean).toBe(Infinity);
  });

  test('toScreenPx scales by the displayed size', () => {
    expect(toScreenPx(1.5, 2)).toBe(3);
    expect(toScreenPx(4, 0.5)).toBe(2);
  });
});

describe('rect and ellipse', () => {
  test('an exact box passes with zero error', () => {
    for (const id of ['rect', 'ellipse'] as const) {
      const ex = exercise(id);
      const s = scoreExercise(ex, [mark(ex.expect, boxOf(ex))], CONTENT, 1);
      expect(s.status).toBe('pass');
      expect(s.error).toBeCloseTo(0, 6);
    }
  });

  test('an edge off by 1.5 units passes at 1× and fails at 2×', () => {
    const ex = exercise('rect');
    const b = boxOf(ex);
    const m = mark('rect', { ...b, w: b.w + 1.5 });
    expect(scoreExercise(ex, [m], CONTENT, 1)).toMatchObject({ status: 'pass', error: 1.5 });
    const at2 = scoreExercise(ex, [m], CONTENT, 2);
    expect(at2.status).toBe('fail');
    expect(at2.errorPx).toBeCloseTo(3);
  });

  test('the nearest of several candidates is the one scored', () => {
    const ex = exercise('rect');
    const b = boxOf(ex);
    const far = mark('rect', { ...b, x: b.x + 6 });
    const near = mark('rect', { ...b, y: b.y + 0.5 });
    const s = scoreExercise(ex, [far, near], CONTENT, 1);
    expect(s.markId).toBe(near.id);
    expect(s.error).toBeCloseTo(0.5, 6);
  });

  test('a mark of the wrong kind is not scored, and is named', () => {
    const ex = exercise('ellipse');
    const s = scoreExercise(ex, [mark('rect', boxOf(ex))], CONTENT, 1);
    expect(s.status).toBe('missing');
    expect(s.reason).toBe('found a rect, expected a ellipse');
  });

  test("a mark in another exercise's cell is not scored here", () => {
    const rect = exercise('rect');
    const color = exercise('color');
    const s = scoreExercise(color, [mark('rect', boxOf(rect))], CONTENT, 1);
    expect(s.status).toBe('missing');
  });
});

describe('line and arrow', () => {
  test('a line passes drawn either way round', () => {
    const ex = exercise('line');
    const { a, b } = segOf(ex);
    expect(scoreExercise(ex, [lineMark('line', a, b)], CONTENT, 1).status).toBe('pass');
    const back = scoreExercise(ex, [lineMark('line', b, a)], CONTENT, 1);
    expect(back.status).toBe('pass');
    expect(back.error).toBeCloseTo(0, 6);
  });

  test('a line reports its further endpoint', () => {
    const ex = exercise('line');
    const { a, b } = segOf(ex);
    const s = scoreExercise(ex, [lineMark('line', shift(a, 0, -1), shift(b, 3, 4))], CONTENT, 1);
    expect(s.error).toBeCloseTo(5, 6);
    expect(s.status).toBe('fail');
  });

  test('an arrow drawn from A to B passes', () => {
    const ex = exercise('arrow');
    const { a, b } = segOf(ex);
    const s = scoreExercise(ex, [lineMark('arrow', a, b)], CONTENT, 1);
    expect(s.status).toBe('pass');
  });

  test('an arrow drawn from B to A fails as reversed', () => {
    const ex = exercise('arrow');
    const { a, b } = segOf(ex);
    const s = scoreExercise(ex, [lineMark('arrow', b, a)], CONTENT, 1);
    expect(s.status).toBe('fail');
    expect(s.reason).toContain('reversed');
  });

  test('a line is not an arrow', () => {
    const ex = exercise('arrow');
    const { a, b } = segOf(ex);
    expect(scoreExercise(ex, [lineMark('line', a, b)], CONTENT, 1).status).toBe('missing');
  });
});

describe('freehand', () => {
  const strokeOver = (points: readonly Pt[]) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return mark('stroke', { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, points);
  };

  test('a stroke on the guide passes for both curves', () => {
    for (const id of ['freehand-circle', 'freehand-sine']) {
      const ex = exercise(id);
      const pts = curveOf(ex).filter((_, i) => i % 16 === 0);
      const s = scoreExercise(ex, [strokeOver(pts)], CONTENT, 1);
      expect(s.status, id).toBe('pass');
      expect(s.error).toBeLessThan(0.01);
      expect(s.max).toBeLessThan(0.01);
    }
  });

  test('a stroke offset by 1.5 units passes at 1×, fails its mean at 2×', () => {
    const ex = exercise('freehand-sine');
    const pts = curveOf(ex)
      .filter((_, i) => i % 16 === 0)
      .map((p) => shift(p, 0, 1.5));
    const m = strokeOver(pts);
    expect(scoreExercise(ex, [m], CONTENT, 1).status).toBe('pass');
    const at2 = scoreExercise(ex, [m], CONTENT, 2);
    expect(at2.status).toBe('fail');
    expect(at2.reason).toContain('mean');
  });

  test('one wild point fails on the max while the mean passes', () => {
    const ex = exercise('freehand-circle');
    const pts = curveOf(ex).filter((_, i) => i % 4 === 0);
    const wild = [...pts];
    const first = wild[10] as Pt;
    // Pushed 8 units outward from the circle's center.
    const c = { x: 160 + 80, y: 120 + 68 };
    const len = Math.hypot(first.x - c.x, first.y - c.y);
    wild[10] = {
      x: c.x + ((first.x - c.x) * (len + 8)) / len,
      y: c.y + ((first.y - c.y) * (len + 8)) / len,
    };
    const s = scoreExercise(ex, [strokeOver(wild)], CONTENT, 1);
    expect(s.status).toBe('fail');
    expect(s.max).toBeCloseTo(8, 3);
    expect(s.errorPx).toBeLessThan(2);
    expect(s.reason).toContain('max');
  });
});

describe('text', () => {
  test('a label starting at the corner passes', () => {
    const ex = exercise('text');
    const b = boxOf(ex);
    const s = scoreExercise(ex, [mark('text', { x: b.x, y: b.y, w: 60, h: 20 })], CONTENT, 1);
    expect(s).toMatchObject({ status: 'pass', inside: true });
    expect(s.error).toBeCloseTo(0, 6);
  });

  test('a label starting outside the box fails, however close', () => {
    const ex = exercise('text');
    const b = boxOf(ex);
    const s = scoreExercise(ex, [mark('text', { x: b.x - 1, y: b.y, w: 60, h: 20 })], CONTENT, 1);
    expect(s.status).toBe('fail');
    expect(s.inside).toBe(false);
    expect(s.error).toBeCloseTo(1, 6);
  });

  test('a label inside the box but away from the corner fails on its offset', () => {
    const ex = exercise('text');
    const b = boxOf(ex);
    const s = scoreExercise(
      ex,
      [mark('text', { x: b.x + 3, y: b.y + 4, w: 60, h: 20 })],
      CONTENT,
      1,
    );
    expect(s).toMatchObject({ status: 'fail', inside: true });
    expect(s.error).toBeCloseTo(5, 6);
  });
});

describe('width and color', () => {
  test('the band passes only at width 8', () => {
    const ex = exercise('band');
    const { a, b } = segOf(ex);
    const thin = scoreExercise(ex, [lineMark('line', a, b)], CONTENT, 1);
    expect(thin.status).toBe('fail');
    expect(thin.width).toEqual({ expected: 8, actual: 2, ok: false });
    const thick = scoreExercise(ex, [lineMark('line', a, b, { width: 8 })], CONTENT, 1);
    expect(thick.status).toBe('pass');
    expect(thick.width?.ok).toBe(true);
  });

  test('the color box passes only in the named color, in any case', () => {
    const ex = exercise('color');
    const b = boxOf(ex);
    const red = scoreExercise(ex, [mark('rect', b)], CONTENT, 1);
    expect(red.status).toBe('fail');
    expect(red.color).toEqual({ expected: CALIBRATION_BLUE, actual: MARK_COLOR, ok: false });
    const blue = scoreExercise(
      ex,
      [mark('rect', b, undefined, { color: CALIBRATION_BLUE.toUpperCase() })],
      CONTENT,
      1,
    );
    expect(blue.status).toBe('pass');
  });

  test('exercises asking for no width or color report none', () => {
    const ex = exercise('rect');
    const s = scoreExercise(ex, [mark('rect', boxOf(ex), undefined, { width: 9 })], CONTENT, 1);
    expect(s.width).toBeUndefined();
    expect(s.color).toBeUndefined();
  });
});

describe('scoreAll', () => {
  test('an empty sheet is missing everywhere, in exercise order', () => {
    const scores = scoreAll(EXERCISES, [], CONTENT, 1);
    expect(scores.map((s) => s.id)).toEqual(EXERCISES.map((e) => e.id));
    expect(scores.every((s) => s.status === 'missing')).toBe(true);
  });

  test('one mark fills only its own exercise', () => {
    const ex = exercise('ellipse');
    const scores = scoreAll(EXERCISES, [mark('ellipse', boxOf(ex))], CONTENT, 1);
    expect(scores.filter((s) => s.status !== 'missing').map((s) => s.id)).toEqual(['ellipse']);
  });
});
