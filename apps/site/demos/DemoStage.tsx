/** @site-chrome */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { StageHandles } from '../DemoFrame';

/**
 * The box a demo's canvas fills: `width` × `height` CSS pixels as the page
 * opens it, plus however far the reader has dragged the resize handles on
 * its right edge, bottom edge and corner.
 * Give the canvas inside no `width` or `height` and it fills this box.
 */
export function DemoStage({ width, height, className, children }: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--demo-stage-w', `${width}px`);
    ref.current?.style.setProperty('--demo-stage-h', `${height}px`);
  }, [width, height]);
  return (
    <div ref={ref} className={className ? `ckd-stage ${className}` : 'ckd-stage'}>
      {children}
      <StageHandles />
    </div>
  );
}
