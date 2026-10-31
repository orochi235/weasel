/**
 * Edits to a quadrant chart's points and named styles as collections, and each one's style, as plain data in and out.
 * A class taken out, or renamed, is taken out of (or renamed on) every point that used it.
 */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import type { QuadrantData, QuadrantPoint, QuadrantPointStyle } from './types';

/** `data` with `point` inserted before point `at`; absent, a point at the center under a fresh name. */
export function insertQuadrantPoint(data: QuadrantData, at: number, point?: QuadrantPoint): QuadrantData {
  const next = point ?? { name: freshName('Point', data.points.map((p) => p.name), data.points.length + 1), x: 0.5, y: 0.5 };
  return { ...data, points: insertAt(data.points, at, next, 'insertQuadrantPoint') };
}

/** `data` without point `point`. Throws on a point it does not hold. */
export const removeQuadrantPoint = (data: QuadrantData, point: number): QuadrantData =>
  ({ ...data, points: removeAt(data.points, point, 'removeQuadrantPoint') });

/** `data` with point `from` moved to index `to`, counted once it is taken out. */
export const moveQuadrantPoint = (data: QuadrantData, from: number, to: number): QuadrantData =>
  (from === to ? data : { ...data, points: moveAt(data.points, from, to, 'moveQuadrantPoint') });

/** `style` with `key` set to `value`, or `undefined` once it holds nothing. */
function restyled(style: QuadrantPointStyle | undefined, key: keyof QuadrantPointStyle, value: string | number | undefined): QuadrantPointStyle | undefined {
  const next = withOptional(style ?? {}, key, value as never);
  return Object.keys(next).length > 0 ? next : undefined;
}

const withPoint = (data: QuadrantData, point: number, change: (p: QuadrantPoint) => QuadrantPoint, who: string): QuadrantData => {
  const points = updateAt(data.points, point, change, who);
  return points[point] === data.points[point] ? data : { ...data, points };
};

/** `data` with a point's style `key` set to `value`; `undefined` drops it, for its class's or the theme's. */
export const setQuadrantPointStyle = <K extends keyof QuadrantPointStyle>(
  data: QuadrantData, point: number, key: K, value: QuadrantPointStyle[K] | undefined,
): QuadrantData => withPoint(data, point, (p) => (p.style?.[key] === value ? p : withOptional(p, 'style', restyled(p.style, key, value))), 'setQuadrantPointStyle');

/** `data` with a point drawn in class `className`; `undefined` drops it. Throws on a class the chart does not hold. */
export function setQuadrantPointClass(data: QuadrantData, point: number, className: string | undefined): QuadrantData {
  if (className !== undefined && data.classes?.[className] === undefined) throw new Error(`setQuadrantPointClass: no class "${className}"`);
  return withPoint(data, point, (p) => (p.className === className ? p : withOptional(p, 'className', className)), 'setQuadrantPointClass');
}

/** The names of the chart's classes, in order. */
export const quadrantClassNames = (data: QuadrantData): string[] => Object.keys(data.classes ?? {});

/** `data` with its classes as `entries`, in order; none drops them. */
const withClasses = (data: QuadrantData, entries: readonly (readonly [string, QuadrantPointStyle])[]): QuadrantData =>
  withOptional(data, 'classes', entries.length > 0 ? Object.fromEntries(entries) : undefined);

/** `data` with a class `name` (absent, a fresh one) of `style` inserted before class `at`. Throws on a name it holds. */
export function insertQuadrantClass(data: QuadrantData, at: number, name?: string, style: QuadrantPointStyle = { radius: 8 }): QuadrantData {
  const names = quadrantClassNames(data);
  const next = name ?? freshName('class', names, names.length + 1, '');
  if (!/^\w+$/.test(next)) throw new Error(`insertQuadrantClass: a class name is letters, digits and underscores, and "${next}" is not`);
  if (names.includes(next)) throw new Error(`insertQuadrantClass: a class is already called "${next}"`);
  return withClasses(data, insertAt(Object.entries(data.classes ?? {}), at, [next, style] as const, 'insertQuadrantClass'));
}

/** `data` without class `index`, every point that used it drawn in its own style. Throws on a class it does not hold. */
export function removeQuadrantClass(data: QuadrantData, index: number): QuadrantData {
  const name = quadrantClassNames(data)[index];
  const next = withClasses(data, removeAt(Object.entries(data.classes ?? {}), index, 'removeQuadrantClass'));
  return { ...next, points: next.points.map((p) => (p.className === name ? withOptional(p, 'className', undefined) : p)) };
}

/** `data` with class `from` moved to index `to`, counted once it is taken out. */
export const moveQuadrantClass = (data: QuadrantData, from: number, to: number): QuadrantData =>
  (from === to ? data : withClasses(data, moveAt(Object.entries(data.classes ?? {}), from, to, 'moveQuadrantClass')));

/** `data` with class `index` called `name`, on every point that used it too. Throws on a name another class holds. */
export function renameQuadrantClass(data: QuadrantData, index: number, name: string): QuadrantData {
  const names = quadrantClassNames(data);
  const from = names[index];
  if (from === undefined) throw new Error(`renameQuadrantClass: no class ${index}`);
  if (from === name) return data;
  if (!/^\w+$/.test(name)) throw new Error(`renameQuadrantClass: a class name is letters, digits and underscores, and "${name}" is not`);
  if (names.includes(name)) throw new Error(`renameQuadrantClass: a class is already called "${name}"`);
  const next = withClasses(data, Object.entries(data.classes!).map(([n, s]) => [n === from ? name : n, s] as const));
  return { ...next, points: next.points.map((p) => (p.className === from ? { ...p, className: name } : p)) };
}

/** `data` with class `index`'s style `key` set to `value`; `undefined` drops it, for the theme's. */
export function setQuadrantClassStyle<K extends keyof QuadrantPointStyle>(
  data: QuadrantData, index: number, key: K, value: QuadrantPointStyle[K] | undefined,
): QuadrantData {
  const entries = Object.entries(data.classes ?? {});
  const target = entries[index];
  if (target === undefined) throw new Error(`setQuadrantClassStyle: no class ${index}`);
  if (target[1][key] === value) return data;
  return withClasses(data, updateAt(entries, index, ([n, s]) => [n, restyled(s, key, value) ?? {}] as [string, QuadrantPointStyle], 'setQuadrantClassStyle'));
}
