/** A branch symbol turned to run down a column: drawn as it runs along a row,
 *  then mirrored across its diagonal, so what entered on the left enters at
 *  the top and what left on the right leaves at the bottom. */
import { pathFromD, pathToD, transformPath, type Affine } from '@weasel-js/geom';
import type { DataMark } from '../marks';
import type { Outline } from '../outline';
import { resolveOutline } from '../outlines/table';
import type { PortAnchor, PortSpec } from '../types';
import type { BranchNode, BranchOptions, BranchSymbol } from './symbolParts';

const DIAGONAL: Affine = [0, 1, 1, 0, 0, 0];
/** Outlines their own mirror image across the diagonal, which keep their name and so their content box. */
const SYMMETRIC = new Set(['rect', 'diamond', 'ellipse']);

const anchor = (at: PortAnchor): PortAnchor => ({ u: at.v, v: at.u });
const vec = (p: { x: number; y: number }) => ({ x: p.y, y: p.x });

/** Path data in the unit square, mirrored across its diagonal. */
export const transposeD = (d: string): string => pathToD(transformPath(pathFromD(d), DIAGONAL));

function outline(o: Outline): Outline {
  if (typeof o === 'string' && SYMMETRIC.has(o)) return o;
  const path = typeof o === 'string' ? resolveOutline(o).path({ x: 0, y: 0, width: 1, height: 1 }) : o;
  return transformPath(path, DIAGONAL);
}

function port(p: PortSpec): PortSpec {
  const out: PortSpec = { ...p, at: anchor(p.at) };
  if (p.sites !== undefined) {
    out.sites = p.sites.map((s) => ({ ...s, ...anchor(s), ...(s.normal ? { normal: vec(s.normal) } : {}) }));
  }
  if (p.normal) out.normal = vec(p.normal);
  return out;
}

function mark(m: DataMark): DataMark {
  if ('d' in m) return { ...m, d: transposeD(m.d) };
  return {
    ...m,
    at: anchor(m.at),
    ...(m.self !== undefined ? { self: anchor(m.self) } : {}),
    ...(m.offset !== undefined ? { offset: vec(m.offset) } : {}),
  };
}

function transpose(node: BranchNode): BranchNode {
  const { width, height, ...rest } = node;
  return {
    ...rest,
    ...(node.outline !== undefined ? { outline: outline(node.outline) } : {}),
    ...(node.ports !== undefined ? { ports: node.ports.map(port) } : {}),
    ...(node.marks !== undefined ? { marks: node.marks.map(mark) } : {}),
    ...(height !== undefined ? { width: height } : {}),
    ...(width !== undefined ? { height: width } : {}),
  };
}

/** `symbol`, following `options.direction`: under `'down'` it is drawn along a
 *  row with control on the top for `controlSide: 'left'` and the bottom for
 *  `'right'`, then turned. */
export const flowing = (symbol: BranchSymbol): BranchSymbol => (stage, pipeline, options) => {
  if (options?.direction !== 'down') return symbol(stage, pipeline, options);
  const row: BranchOptions = { ...options, direction: 'right', controlSide: options.controlSide === 'right' ? 'bottom' : 'top' };
  return transpose(symbol(stage, pipeline, row));
};
