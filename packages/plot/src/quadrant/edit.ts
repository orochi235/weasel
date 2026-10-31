/** Edits to a quadrant chart, as plain data in and out. */
import type { QuadrantData, QuadrantPoint } from './types';

function withPoint(data: QuadrantData, point: number, change: Partial<QuadrantPoint>, who: string): QuadrantData {
  const target = data.points[point];
  if (target === undefined) throw new Error(`${who}: the chart holds no point ${point}`);
  if (Object.entries(change).every(([k, v]) => target[k as keyof QuadrantPoint] === v)) return data;
  return { ...data, points: data.points.map((p, i) => (i === point ? { ...p, ...change } : p)) };
}

/** `data` with point `point` moved to `x`, `y`. Throws on a point the chart does not hold. */
export const setQuadrantPoint = (data: QuadrantData, point: number, at: { x: number; y: number }): QuadrantData =>
  withPoint(data, point, { x: at.x, y: at.y }, 'setQuadrantPoint');

/** `data` with point `point` named `name`. Throws on a point the chart does not hold. */
export const setQuadrantPointName = (data: QuadrantData, point: number, name: string): QuadrantData =>
  withPoint(data, point, { name }, 'setQuadrantPointName');

/** `data` with an axis's end labeled `text`; an empty one drops it. */
export function setQuadrantAxisLabel(data: QuadrantData, axis: 'x' | 'y', end: 'low' | 'high', text: string): QuadrantData {
  const ends = data[axis] ?? {};
  if ((ends[end] ?? '') === text) return data;
  const { [end]: _, ...rest } = ends;
  const next = text === '' ? rest : { ...rest, [end]: text };
  const { [axis]: __, ...others } = data;
  return Object.keys(next).length === 0 ? others as QuadrantData : { ...others, [axis]: next } as QuadrantData;
}

/** `data` with quadrant `quadrant` (1 to 4, Mermaid's numbering) labeled `text`; an empty one drops it. Throws on any other number. */
export function setQuadrantLabel(data: QuadrantData, quadrant: number, text: string): QuadrantData {
  if (![1, 2, 3, 4].includes(quadrant)) throw new Error(`setQuadrantLabel: there is no quadrant ${quadrant}`);
  if ((data.quadrants?.[quadrant - 1] ?? '') === text) return data;
  const labels: (string | undefined)[] = [0, 1, 2, 3].map((i) => data.quadrants?.[i]);
  labels[quadrant - 1] = text === '' ? undefined : text;
  const { quadrants: _, ...rest } = data;
  while (labels.length > 0 && labels[labels.length - 1] === undefined) labels.pop();
  return labels.length === 0 ? rest : { ...rest, quadrants: labels as NonNullable<QuadrantData['quadrants']> };
}
