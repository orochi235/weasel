import type { LoupeMode, LoupePoint } from '@weasel-js/loupe';
import type { CSSProperties } from 'react';
import { zoomAt } from '../canvas/camera';
import type { ViewportSize, WorldFrame } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import type { LoupeRenderArgs } from './types';

/** Props for `<DomLoupe>`. */
export interface DomLoupeProps {
  aim: LoupePoint;
  factor: number;
  mode: LoupeMode;
  diameter: number;
  /** The host the instrument draws into, which the stage reproduces. */
  size: ViewportSize;
  /** The trial's own camera. */
  view: ViewTransform;
  frame?: WorldFrame;
  state: unknown;
  config: unknown;
  render: (args: LoupeRenderArgs) => React.ReactNode;
}

/**
 * Paints a lens over DOM content by asking the instrument to draw itself again
 * at a magnified camera.
 *
 * The stage is a full copy of the host, so the instrument's own layout still
 * holds; the camera is composed about the aimed point, which keeps that point
 * where it already was, and the stage is then slid by `diameter / 2 - aim` to
 * bring it to the middle of the lens.
 */
export function DomLoupe({
  aim,
  factor,
  mode,
  diameter,
  size,
  view,
  frame,
  state,
  config,
  render,
}: DomLoupeProps) {
  const style: CSSProperties = {
    width: `${size.width}px`,
    height: `${size.height}px`,
    transform: `translate(${diameter / 2 - aim.x}px, ${diameter / 2 - aim.y}px)`,
  };
  return (
    <div className="lk-loupe__stage" style={style}>
      {render({
        state,
        config,
        view: zoomAt(view, factor, aim, { frame }),
        factor,
        mode,
        size,
      })}
    </div>
  );
}
