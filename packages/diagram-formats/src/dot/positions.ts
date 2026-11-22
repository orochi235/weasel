/** Where a DOT graph's nodes sit, read from their `pos` attributes. */
import type { DataNode } from '@weasel-js/diagram';
import type { DotValue } from './parse';

export type Attrs = Map<string, DotValue>;

export const POINTS_PER_INCH = 72;
export const round = (n: number) => Math.round(n * 100) / 100;
export const str = (attrs: Attrs, key: string) => attrs.get(key)?.value;

const least = (m: number, v: number) => Math.min(m, v);
const most = (m: number, v: number) => Math.max(m, v);

/** Each node's place from its `pos`, and the page's size, when every node has one; else `null`. A graph with a `bb` is
 *  layout output, its `pos` in points; one without is input to neato, its `pos` in inches. */
export function positions(nodes: DataNode[], attrs: ReadonlyMap<string, Attrs>, bb: string | undefined) {
  const unit = bb === undefined ? POINTS_PER_INCH : 1;
  const centers = nodes.map((n) => str(attrs.get(n.id)!, 'pos')?.replace(/!$/, '').split(',').map((v) => Number(v) * unit));
  if (nodes.length === 0 || centers.some((c) => c === undefined || c.length < 2 || !c.every(Number.isFinite))) return null;
  const size = (n: DataNode) => ({ width: n.width ?? 0.75 * POINTS_PER_INCH, height: n.height ?? 0.5 * POINTS_PER_INCH });
  const box = bb?.split(',').map(Number);
  const xs = nodes.flatMap((n, i) => [centers[i]![0]! - size(n).width / 2, centers[i]![0]! + size(n).width / 2]);
  const ys = nodes.flatMap((n, i) => [centers[i]![1]! - size(n).height / 2, centers[i]![1]! + size(n).height / 2]);
  const [llx, lly, right, top] = box?.length === 4 && box.every(Number.isFinite)
    ? box : [xs.reduce(least, Infinity), ys.reduce(least, Infinity), xs.reduce(most, -Infinity), ys.reduce(most, -Infinity)];
  const placed = nodes.map((n, i) => ({
    ...n, ...size(n), at: { x: round(centers[i]![0]! - llx! - size(n).width / 2), y: round(top - centers[i]![1]! - size(n).height / 2) },
  }));
  return { nodes: placed, size: { width: round(right - llx!), height: round(top - lly!) } };
}
