import type { RectPose } from '@weasel-js/core';
import { headerBox, type ContainerHeader } from './trait';

type Box = { x: number; y: number; width: number; height: number };

/** Where a container's title sits: its header strip, turned a quarter to run
 *  up a left header. */
export function titlePose(bounds: Box, header: ContainerHeader | undefined): RectPose {
  const h = headerBox(bounds, header) ?? { ...bounds, height: 0 };
  if (header?.side !== 'left') return { x: h.x, y: h.y, width: h.width, height: h.height };
  const cx = h.x + h.width / 2;
  const cy = h.y + h.height / 2;
  return { x: cx - h.height / 2, y: cy - h.width / 2, width: h.height, height: h.width, rotation: -Math.PI / 2 };
}

/** {@link titlePose} as the title is stored: in its container's own frame. */
export function titleInFrame(size: { width: number; height: number }, header: ContainerHeader | undefined): RectPose {
  return titlePose({ x: 0, y: 0, width: size.width, height: size.height }, header);
}
