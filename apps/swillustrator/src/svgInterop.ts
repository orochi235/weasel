/**
 * Bridge between Swillustrator's `Obj` discriminated union and
 * `@orochi235/weasel-svg`'s `SvgNode` discriminated union. Each direction
 * is intentionally lossy at the edges (RectObj's stroke/strokeWidth
 * compresses to an SvgStroke; SvgGroupNode flattens on import) — see
 * comments inline for the specifics.
 */

import type { Path, PolygonPath, TextStyle } from '@orochi235/weasel';
import type {
  SvgNode,
  SvgPathNode,
  SvgTextNode,
} from '@orochi235/weasel-svg';

interface BaseObj { id: string; kind: 'rect' | 'text' | 'path'; x: number; y: number; width: number; height: number }
interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
type Obj = RectObj | TextObj | PathObj;

/** Lower one Swillustrator object to an SvgNode for serialization. */
export function objToSvgNode(o: Obj): SvgNode {
  if (o.kind === 'text') {
    const node: SvgTextNode = {
      kind: 'text',
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      text: o.text,
    };
    if (o.style) node.style = o.style;
    return node;
  }
  if (o.kind === 'rect') {
    const path: Path = { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height };
    const node: SvgPathNode = {
      kind: 'path',
      path,
      fill: { kind: 'solid', color: o.fill },
    };
    if (o.strokeWidth > 0) {
      node.stroke = { paint: { kind: 'solid', color: o.stroke }, width: o.strokeWidth };
    }
    return node;
  }
  // path
  const node: SvgPathNode = {
    kind: 'path',
    path: o.path,
    fill: o.closed ? { kind: 'solid', color: o.fill } : { kind: 'none' },
  };
  if (o.strokeWidth > 0) {
    node.stroke = { paint: { kind: 'solid', color: o.stroke }, width: o.strokeWidth };
  }
  return node;
}

/**
 * Walk an SvgNode tree and emit a flat list of Swillustrator objects.
 * Groups flatten on import (children inlined; group-level transform was
 * already collapsed onto leaves by `parseSvg`). Unsupported leaf shapes
 * (gradient fills, paint-not-solid) drop down to a black solid color so
 * the document at least opens.
 */
export function svgNodesToObjs(
  nodes: readonly SvgNode[],
  nextId: () => string,
): Obj[] {
  const out: Obj[] = [];
  const visit = (n: SvgNode): void => {
    if (n.kind === 'group') {
      n.children.forEach(visit);
      return;
    }
    if (n.kind === 'text') {
      const o: TextObj = {
        id: nextId(),
        kind: 'text',
        x: n.x, y: n.y, width: n.width, height: n.height,
        text: n.text,
      };
      if (n.style) o.style = n.style;
      out.push(o);
      return;
    }
    // path
    const fill = colorFromPaint(n.fill, '#000000');
    const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
    const strokeWidth = n.stroke?.width ?? 0;
    if (n.path.kind === 'rect') {
      out.push({
        id: nextId(),
        kind: 'rect',
        x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height,
        fill, stroke, strokeWidth,
      });
      return;
    }
    // PolygonPath. Use the path's own bounding box (the SVG didn't carry
    // one). `closed` is best-effort: if the underlying command stream ends
    // with PATH_Z (4), treat it as closed.
    const path = n.path as PolygonPath;
    const bounds = pathBounds(path);
    const closed = isClosedPolygon(path);
    out.push({
      id: nextId(),
      kind: 'path',
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      path,
      closed,
      fill, stroke, strokeWidth,
    });
  };
  nodes.forEach(visit);
  return out;
}

function colorFromPaint(
  paint: SvgPathNode['fill'] | { kind: 'gradient'; paint: unknown },
  fallback: string,
): string {
  if (paint.kind === 'none') return fallback;
  if (paint.kind === 'solid') return paint.color;
  // Gradients can't be represented as Swillustrator's flat fill string yet —
  // drop to fallback. Caller's UI shows a solid color; the gradient is lost.
  return fallback;
}

function pathBounds(path: PolygonPath): { x: number; y: number; width: number; height: number } {
  const coords = path.coords;
  if (coords.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i];
    const y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function isClosedPolygon(path: PolygonPath): boolean {
  const commands = path.commands;
  if (commands.length === 0) return false;
  const last = commands[commands.length - 1];
  return last === 4 /* PATH_Z */;
}

/** Trigger a browser download of `svg` as a file named `filename`. */
export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pop a hidden file input; resolve with the chosen file's text (or null
 * if the user cancelled). Single-shot — the input is created and removed
 * per invocation so there's no accumulated DOM cruft.
 */
export function pickSvgFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.style.display = 'none';
    document.body.appendChild(input);
    let resolved = false;
    const cleanup = (): void => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        if (!resolved) { resolved = true; resolve(null); }
        cleanup();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (!resolved) { resolved = true; resolve(String(reader.result ?? '')); }
        cleanup();
      };
      reader.onerror = () => {
        if (!resolved) { resolved = true; resolve(null); }
        cleanup();
      };
      reader.readAsText(file);
    });
    // Fallback: if the picker is dismissed without firing change, give up.
    input.addEventListener('cancel', () => {
      if (!resolved) { resolved = true; resolve(null); }
      cleanup();
    });
    input.click();
  });
}
