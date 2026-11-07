/**
 * The DOM of a canvas painted partly by a worker: one box sized as a lone canvas would be, and
 * inside it a canvas per run of layers, bottom first, with the input canvas on top.
 */
import { useCallback, type CSSProperties, type ReactElement } from 'react';
import { adoptCssOnce } from '@weasel-js/react';
import { SURFACE_RULE } from '../SurfaceCanvas';
import { runsKey } from './layerRuns';
import type { WorkerStack } from './useWorkerStack';

/** Every canvas fills the box; only the top one takes input. */
const STACK_RULE =
  ':where([data-wzl-stack]) { position: relative; }'
  + ' :where([data-wzl-stack]) > canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }'
  + ' :where([data-wzl-stack]) > canvas:not(:last-child) { pointer-events: none; }';

export interface WorkerCanvasStackProps {
  stack: WorkerStack;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  /** The input canvas, which paints the topmost run. */
  top: ReactElement;
}

export function WorkerCanvasStack({ stack, width, height, className, style, top }: WorkerCanvasStackProps) {
  const adopt = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      adoptCssOnce(el, SURFACE_RULE);
      adoptCssOnce(el, STACK_RULE);
    }
  }, []);
  const sized = {
    ...style,
    ...(width !== undefined ? { '--wzl-surface-width': `${width}px` } : {}),
    ...(height !== undefined ? { '--wzl-surface-height': `${height}px` } : {}),
  };
  const fills = width === undefined || height === undefined;
  const key = runsKey(stack.runs);
  return (
    <div ref={adopt} className={className} style={sized as CSSProperties} data-wzl-surface={fills ? 'fill' : ''} data-wzl-stack="">
      {stack.runs.slice(0, -1).map((run, i) => (
        <canvas key={`${key}-${i}`} ref={stack.canvasRef(i)} data-wzl-run={run.by} />
      ))}
      {top}
    </div>
  );
}
