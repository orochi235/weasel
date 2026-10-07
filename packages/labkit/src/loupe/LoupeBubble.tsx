import { type LoupePoint, type LoupeSize, loupeExtent } from '@weasel-js/loupe';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { LoupeShape } from './types';

/** Props for `<LoupeBubble>`. */
export interface LoupeBubbleProps {
  /** Where the lens is centered, in its container's own pixels. */
  aim: LoupePoint;
  /** One number for a round or square lens, or a width and a height. */
  diameter: LoupeSize;
  /** Default `'circle'`; on a box that is not square, `'circle'` is an ellipse. */
  shape?: LoupeShape;
  /** Only the ring and shadow: the inside is left clear for what is under it. */
  hollow?: boolean;
  hostRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}

/**
 * The lens itself: a circle or a rectangle centered on `aim`, clipping whatever
 * a painter draws into it.
 *
 * It takes no pointer events, so the pan, the wheel and anything underneath
 * keep working while it is up — and it is `aria-hidden`, since it magnifies
 * content already on the page rather than adding any.
 */
export function LoupeBubble({
  aim,
  diameter,
  shape = 'circle',
  hollow,
  hostRef,
  children,
}: LoupeBubbleProps) {
  const { width, height } = loupeExtent(diameter);
  const square = shape === 'square';
  const style = {
    '--lk-loupe-width': `${width}px`,
    '--lk-loupe-height': `${height}px`,
    transform: `translate(${aim.x - width / 2}px, ${aim.y - height / 2}px)`,
  } as CSSProperties;
  return (
    <div
      ref={hostRef}
      className={['lk-loupe', square && 'lk-loupe--square', hollow && 'lk-loupe--hollow']
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
