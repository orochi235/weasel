import type { AnnotationKind } from '../types';

/** A point in content units. */
export interface Pt {
  x: number;
  y: number;
}

/** A box in content units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What a guide asks to be traced: a box (a rectangle, an ellipse's bounds, a text label's
 *  frame), a segment from `a` to `b`, or a curve sampled densely enough to measure against. */
export type Guide =
  | { kind: 'box'; box: Box }
  | { kind: 'segment'; a: Pt; b: Pt }
  | { kind: 'curve'; points: readonly Pt[] };

/** One thing to trace on the calibration picture. */
export interface Exercise {
  id: string;
  instruction: string;
  expect: AnnotationKind;
  guide: Guide;
  /** The cell the exercise owns: only a mark centered in it is scored against it. */
  area: Box;
  width?: number;
  color?: string;
}

/** The calibration picture's own size. */
export const CONTENT = { w: 480, h: 360 } as const;

const CELL = { w: 160, h: 120 };
/** The color the named-color exercise asks for: far from the default mark red. */
export const CALIBRATION_BLUE = '#0090ff';
const SAMPLES = 512;

function cell(col: number, row: number): Box {
  return { x: col * CELL.w, y: row * CELL.h, w: CELL.w, h: CELL.h };
}

const at = (c: Box, x: number, y: number): Pt => ({ x: c.x + x, y: c.y + y });
const boxIn = (c: Box, x: number, y: number, w: number, h: number): Box => ({
  x: c.x + x,
  y: c.y + y,
  w,
  h,
});

/** `fn` sampled at `SAMPLES + 1` evenly spaced `t` in [0, 1]. */
function sampled(fn: (t: number) => Pt): Pt[] {
  return Array.from({ length: SAMPLES + 1 }, (_, i) => fn(i / SAMPLES));
}

function circle(c: Pt, r: number): Pt[] {
  return sampled((t) => ({
    x: c.x + r * Math.cos(2 * Math.PI * t),
    y: c.y + r * Math.sin(2 * Math.PI * t),
  }));
}

function sine(from: Pt, length: number, amplitude: number): Pt[] {
  return sampled((t) => ({
    x: from.x + length * t,
    y: from.y - amplitude * Math.sin(2 * Math.PI * t),
  }));
}

function build(): readonly Exercise[] {
  const c = [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)];
  const d = [cell(0, 2), cell(1, 2), cell(2, 2)];
  const [c0, c1, c2, c3, c4, c5] = c as [Box, Box, Box, Box, Box, Box];
  const [d0, d1, d2] = d as [Box, Box, Box];
  return [
    {
      id: 'rect',
      instruction: 'Box this rectangle',
      expect: 'rect',
      area: c0,
      guide: { kind: 'box', box: boxIn(c0, 20, 30, 120, 70) },
    },
    {
      id: 'ellipse',
      instruction: 'Ring this circle',
      expect: 'ellipse',
      area: c1,
      guide: { kind: 'box', box: boxIn(c1, 44, 30, 72, 72) },
    },
    {
      id: 'line',
      instruction: 'Trace this diagonal line',
      expect: 'line',
      area: c2,
      guide: { kind: 'segment', a: at(c2, 20, 104), b: at(c2, 140, 30) },
    },
    {
      id: 'arrow',
      instruction: 'Draw an arrow from A to B',
      expect: 'arrow',
      area: c3,
      guide: { kind: 'segment', a: at(c3, 24, 100), b: at(c3, 136, 36) },
    },
    {
      id: 'freehand-circle',
      instruction: 'Trace this circle freehand',
      expect: 'stroke',
      area: c4,
      guide: { kind: 'curve', points: circle(at(c4, 80, 68), 36) },
    },
    {
      id: 'freehand-sine',
      instruction: 'Trace this wave freehand',
      expect: 'stroke',
      area: c5,
      guide: { kind: 'curve', points: sine(at(c5, 16, 68), 128, 28) },
    },
    {
      id: 'text',
      instruction: 'Start a text label at the dot',
      expect: 'text',
      area: d0,
      guide: { kind: 'box', box: boxIn(d0, 30, 44, 100, 44) },
    },
    {
      id: 'band',
      instruction: 'Line along the band, width 8',
      expect: 'line',
      area: d1,
      guide: { kind: 'segment', a: at(d1, 20, 68), b: at(d1, 140, 68) },
      width: 8,
    },
    {
      id: 'color',
      instruction: `Box this in blue (${CALIBRATION_BLUE})`,
      expect: 'rect',
      area: d2,
      guide: { kind: 'box', box: boxIn(d2, 30, 36, 100, 64) },
      color: CALIBRATION_BLUE,
    },
  ];
}

/** Every exercise on the calibration picture, one per 160×120 cell of a 3×3 grid. */
export const EXERCISES: readonly Exercise[] = build();
