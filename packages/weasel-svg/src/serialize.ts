/**
 * Serialize a `SvgNode[]` tree to an SVG document string. Every leaf is
 * emitted as a `<path>` (even shapes that started as `<rect>` etc.) —
 * lossless geometry round-trip beats round-tripping the element-kind
 * label. Gradient paints are gathered into a single `<defs>` block.
 */

import type { Path } from '@orochi235/weasel';
import { boundsOfPath } from '@orochi235/weasel';
import type { SerializeOptions, SvgGroupNode, SvgNode, SvgPaint, SvgPathNode, SvgStroke, SvgTextNode } from './types';
import { runsToPlainText } from '@orochi235/weasel';
import { serializePathD } from './path-serializer';
import { formatMatrix, trimNumber } from './transform';
import { GradientRegistry } from './gradients';

/**
 * Walk the tree and produce an SVG document string. The root `<svg>`'s
 * `viewBox` is taken from `opts.viewBox` if supplied, otherwise computed
 * as a tight bounding box around every leaf.
 */
export function serializeSvg(nodes: SvgNode[], opts: SerializeOptions = {}): string {
  const registry = new GradientRegistry();
  registerGradients(nodes, registry);

  const bounds = opts.viewBox ?? computeBounds(nodes);
  const vb = `${trimNumber(bounds.x)} ${trimNumber(bounds.y)} ${trimNumber(bounds.width)} ${trimNumber(bounds.height)}`;

  const defsXml = registry.toDefsXml();
  const bodyXml = nodes.map((n) => nodeXml(n, registry)).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defsXml}${bodyXml}</svg>`
  );
}

function registerGradients(nodes: SvgNode[], registry: GradientRegistry): void {
  for (const n of nodes) {
    if (n.kind === 'group') {
      registerGradients(n.children, registry);
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
    } else if (n.kind === 'text') {
      // Text gradient fills flow through style.fill rather than a top-level
      // SvgPaint, so register direct Paint references when present.
      const styleFill = n.style?.fill;
      if (styleFill && !('color' in styleFill)) {
        registry.register(styleFill);
      }
    }
  }
}

function nodeXml(node: SvgNode, registry: GradientRegistry): string {
  if (node.kind === 'group') return groupXml(node, registry);
  if (node.kind === 'text') return textXml(node, registry);
  return pathXml(node, registry);
}

function groupXml(node: SvgGroupNode, registry: GradientRegistry): string {
  const attrs: string[] = [];
  if (node.transform) {
    const m = formatMatrix(node.transform);
    if (m) attrs.push(`transform="${m}"`);
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  const head = attrs.length > 0 ? `<g ${attrs.join(' ')}>` : '<g>';
  const body = node.children.map((c) => nodeXml(c, registry)).join('');
  return `${head}${body}</g>`;
}

function pathXml(node: SvgPathNode, registry: GradientRegistry): string {
  const attrs: string[] = [`d="${serializePathD(node.path)}"`];
  const fillAttrs = paintAttrs(node.fill, 'fill', registry);
  for (const a of fillAttrs) attrs.push(a);
  if (node.stroke) {
    const strokeAttrs = strokeAttrsFor(node.stroke, registry);
    for (const a of strokeAttrs) attrs.push(a);
  } else {
    attrs.push('stroke="none"');
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }
  return `<path ${attrs.join(' ')}/>`;
}

function paintAttrs(
  paint: SvgPaint,
  name: 'fill' | 'stroke',
  registry: GradientRegistry,
): string[] {
  if (paint.kind === 'none') return [`${name}="none"`];
  if (paint.kind === 'solid') {
    const out = [`${name}="${paint.color}"`];
    if (paint.opacity != null && paint.opacity !== 1) {
      out.push(`${name}-opacity="${trimNumber(paint.opacity)}"`);
    }
    return out;
  }
  // gradient
  const id = registry.register(paint.paint);
  return [`${name}="url(#${id})"`];
}

function strokeAttrsFor(stroke: SvgStroke, registry: GradientRegistry): string[] {
  const attrs = paintAttrs(stroke.paint, 'stroke', registry);
  attrs.push(`stroke-width="${trimNumber(stroke.width)}"`);
  if (stroke.opacity != null && stroke.opacity !== 1) {
    attrs.push(`stroke-opacity="${trimNumber(stroke.opacity)}"`);
  }
  if (stroke.cap) {
    attrs.push(`stroke-linecap="${stroke.cap}"`);
  }
  if (stroke.join) {
    attrs.push(`stroke-linejoin="${stroke.join}"`);
  }
  if (stroke.dash && stroke.dash.length > 0) {
    attrs.push(`stroke-dasharray="${stroke.dash.map(trimNumber).join(' ')}"`);
  }
  if (stroke.miterLimit != null) {
    attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  }
  return attrs;
}

function computeBounds(nodes: SvgNode[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (n: SvgNode): void => {
    if (n.kind === 'group') {
      n.children.forEach(visit);
      return;
    }
    const b = n.kind === 'text'
      ? { minX: n.x, minY: n.y, maxX: n.x + n.width, maxY: n.y + n.height }
      : pathBounds(n.path);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  };
  nodes.forEach(visit);
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Emit a `<text>` element. Uses `dominant-baseline="text-before-edge"` so
 * the `y` attribute matches weasel's top-of-box pose; stashes the explicit
 * width/height (which native SVG text doesn't model) in `data-weasel-*`
 * attributes so they round-trip through the parser losslessly.
 */
function textXml(node: SvgTextNode, registry: GradientRegistry): string {
  const attrs: string[] = [
    `x="${trimNumber(node.x)}"`,
    `y="${trimNumber(node.y)}"`,
    `dominant-baseline="text-before-edge"`,
    `data-weasel-width="${trimNumber(node.width)}"`,
    `data-weasel-height="${trimNumber(node.height)}"`,
  ];

  const style = node.style;
  if (style?.fontSize != null) attrs.push(`font-size="${trimNumber(style.fontSize)}"`);
  if (style?.fontFamily) attrs.push(`font-family="${escapeAttr(style.fontFamily)}"`);
  if (style?.fontWeight != null) attrs.push(`font-weight="${String(style.fontWeight)}"`);
  if (style?.fontStyle && style.fontStyle !== 'normal') attrs.push(`font-style="${style.fontStyle}"`);
  if (style?.align && style.align !== 'left') {
    const anchor = style.align === 'center' ? 'middle' : 'end';
    attrs.push(`text-anchor="${anchor}"`);
  }
  if (style?.lineHeight != null) {
    attrs.push(`data-weasel-line-height="${trimNumber(style.lineHeight)}"`);
  }
  if (style?.fill) {
    if ('color' in style.fill) {
      attrs.push(`fill="${style.fill.color}"`);
      if (style.fill.opacity != null && style.fill.opacity !== 1) {
        attrs.push(`fill-opacity="${trimNumber(style.fill.opacity)}"`);
      }
    } else {
      const id = registry.register(style.fill);
      attrs.push(`fill="url(#${id})"`);
    }
  }
  if (node.opacity != null && node.opacity !== 1) {
    attrs.push(`opacity="${trimNumber(node.opacity)}"`);
  }

  const body = node.runs && node.runs.length > 0
    ? node.runs.map((r) => runXml(r, registry)).join('')
    : escapeText(node.text);
  return `<text ${attrs.join(' ')}>${body}</text>`;
}

function runXml(run: import('@orochi235/weasel').StyledRun, registry: GradientRegistry): string {
  const attrs: string[] = [];
  if (run.bold) attrs.push(`font-weight="700"`);
  if (run.italic) attrs.push(`font-style="italic"`);
  if (run.fontFamily) attrs.push(`font-family="${escapeAttr(run.fontFamily)}"`);
  if (run.fontSize != null) attrs.push(`font-size="${trimNumber(run.fontSize)}"`);
  if (run.fill) {
    if ('color' in run.fill) {
      attrs.push(`fill="${run.fill.color}"`);
    } else {
      const id = registry.register(run.fill);
      attrs.push(`fill="url(#${id})"`);
    }
  }
  const head = attrs.length > 0 ? `<tspan ${attrs.join(' ')}>` : '<tspan>';
  return `${head}${escapeText(run.text)}</tspan>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Silence unused-import warnings when the runs export gets tree-shaken.
void runsToPlainText;

function pathBounds(path: Path): { minX: number; minY: number; maxX: number; maxY: number } {
  if (path.kind === 'rect') {
    return {
      minX: path.x, minY: path.y,
      maxX: path.x + path.width, maxY: path.y + path.height,
    };
  }
  const b = boundsOfPath(path);
  return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
}

