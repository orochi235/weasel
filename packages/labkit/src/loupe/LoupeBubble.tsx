import type { LoupePoint } from '@weasel-js/loupe';
import type { CSSProperties, ReactNode, RefObject } from 'react';

/** Props for `<LoupeBubble>`. */
export interface LoupeBubbleProps {
  /** Where the lens is aimed, in its container's own pixels. */
  aim: LoupePoint;
  diameter: number;
  hostRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/**
 * The lens itself: a circle centred on the aimed point, clipping whatever a
 * painter draws into it.
 *
 * It takes no pointer events, so the pan, the wheel and anything underneath
 * keep working while it is up — and it is `aria-hidden`, since it magnifies
 * content already on the page rather than adding any.
 */
export function LoupeBubble({ aim, diameter, hostRef, children }: LoupeBubbleProps) {
  const style: CSSProperties = {
    width: `${diameter}px`,
    height: `${diameter}px`,
    transform: `translate(${aim.x - diameter / 2}px, ${aim.y - diameter / 2}px)`,
  };
  return (
    <div ref={hostRef} className="lk-loupe" style={style} aria-hidden="true">
      {children}
    </div>
  );
}
