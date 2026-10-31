/** The XML elements draw-style cells are written as. */
import type { Vec2 } from '@weasel-js/core/math';
import { escapeAttr } from '@weasel-js/svg';
import type { Box } from './pageCells';

/** A coordinate to four places, which is as fine as anything here is drawn. */
export const num = (n: number): string => String(Math.round(n * 10000) / 10000);

/** Attributes, in order, leaving out those with no value. */
export function attrs(pairs: readonly (readonly [string, string | number | undefined])[]): string {
  return pairs
    .filter((p): p is readonly [string, string | number] => p[1] !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(typeof v === 'number' ? num(v) : v)}"`)
    .join('');
}

/** A vertex cell: its box, relative to `origin`, the corner of the cell holding it. */
export function vertexXml(cell: { id: string; value: string; style: string; parent: string; group?: boolean }, box: Box, origin: Vec2): string {
  const head = attrs([
    ['id', cell.id], ['value', cell.value], ['style', cell.style], ['vertex', '1'],
    ['connectable', cell.group === true ? '0' : undefined], ['parent', cell.parent],
  ]);
  const geometry = attrs([['x', box.x - origin.x], ['y', box.y - origin.y], ['width', box.width], ['height', box.height], ['as', 'geometry']]);
  return `        <mxCell${head}>\n          <mxGeometry${geometry} />\n        </mxCell>\n`;
}

/** An edge cell: its ends, its label's place along it as `x` from -1 to 1 and `y` off the line, and its bend points. */
export function edgeXml(
  cell: { id: string; value: string; style: string; parent: string; source: string; target: string },
  label: { x: number; y: number } | undefined, points: readonly Vec2[],
): string {
  const head = attrs([
    ['id', cell.id], ['value', cell.value], ['style', cell.style], ['edge', '1'], ['parent', cell.parent],
    ['source', cell.source], ['target', cell.target],
  ]);
  const geometry = attrs([['x', label?.x], ['y', label?.y], ['relative', '1'], ['as', 'geometry']]);
  if (points.length === 0) return `        <mxCell${head}>\n          <mxGeometry${geometry} />\n        </mxCell>\n`;
  const list = points.map((p) => `              <mxPoint${attrs([['x', p.x], ['y', p.y]])} />\n`).join('');
  return `        <mxCell${head}>\n          <mxGeometry${geometry}>\n            <Array as="points">\n${list}            </Array>\n`
    + '          </mxGeometry>\n        </mxCell>\n';
}

/** A label on edge `parent` at one end, `x` -1 for its source and 1 for its target, as draw.io writes a multiplicity. */
export function endLabelXml(cell: { id: string; value: string; parent: string }, x: -1 | 1): string {
  const head = attrs([
    ['id', cell.id], ['value', cell.value], ['style', `edgeLabel;html=1;resizable=0;align=${x < 0 ? 'left' : 'right'};verticalAlign=bottom;`],
    ['vertex', '1'], ['connectable', '0'], ['parent', cell.parent],
  ]);
  return `        <mxCell${head}>\n          <mxGeometry${attrs([['x', x], ['relative', '1'], ['as', 'geometry']])}>\n`
    + '            <mxPoint as="offset" />\n          </mxGeometry>\n        </mxCell>\n';
}
