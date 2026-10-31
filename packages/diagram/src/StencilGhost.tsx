import { pathToD } from '@weasel-js/geom';
import type { ReactElement } from 'react';
import type { ContainerStencil } from './containers/containerStencils';
import { NODE_STROKE_WIDTH, type NodeStyle } from './dataTypes';
import { outlineDetail, outlinePath, outlineSolid } from './outline';
import type { DiagramStencil } from './stencil';

/** Props for {@link StencilGhost}. */
export interface StencilGhostProps {
  stencil: DiagramStencil | ContainerStencil;
  /** What it is drawn in: the style its body is inserted with. A stencil's own `style` is laid over it. */
  style: NodeStyle;
  /** Screen pixels per world unit, so it is drawn at the size it lands at under the view's zoom. Default 1. */
  scale?: number;
}

/**
 * `stencil`'s outline as an SVG, the size a click would place it at, in `style`: what a drag from a palette shows
 * on its way to the canvas. A container draws its frame. Holds no text.
 */
export function StencilGhost({ stencil, style, scale = 1 }: StencilGhostProps): ReactElement {
  const own = 'outline' in stencil ? { ...style, ...stencil.style } : style;
  const width = own.strokeWidth ?? NODE_STROKE_WIDTH;
  const bounds = { x: width / 2, y: width / 2, ...stencil.size };
  const outline = 'outline' in stencil ? stencil.outline : 'rect';
  const detail = outlineDetail(outline, bounds);
  const solid = outlineSolid(outline, bounds);
  const box = { width: stencil.size.width + width, height: stencil.size.height + width };
  const stroke = { stroke: own.stroke, strokeWidth: width, strokeDasharray: own.dash?.join(' ') };
  return (
    <svg
      width={box.width * scale} height={box.height * scale} viewBox={`0 0 ${box.width} ${box.height}`}
      aria-hidden="true" overflow="visible" data-stencil={stencil.id}
    >
      <path d={pathToD(outlinePath(outline, bounds))} fill={own.fill} {...stroke} />
      {solid && <path d={pathToD(solid)} fill={own.stroke} />}
      {detail && <path d={pathToD(detail)} fill="none" {...stroke} />}
    </svg>
  );
}
