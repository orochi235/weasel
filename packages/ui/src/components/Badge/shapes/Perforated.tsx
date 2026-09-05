import { useEffect, useId, useRef } from 'react';
import type { ShapeModule } from '../types';
import { useSvgBox } from '../useSvgBox';

export interface PerforatedParams {
  holeRadius?: number;
  holePitch?: number;
}

const DEFAULTS: Required<PerforatedParams> = { holeRadius: 3.5, holePitch: 11 };

function PerforatedComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: PerforatedParams;
}) {
  const cfg = { ...DEFAULTS, ...params };
  const maskId = useId();
  const ref = useRef<SVGGElement>(null);
  const box = useSvgBox(ref);

  // Convert CSS-px hole sizing into viewBox units so holes look circular on either axis.
  const rx = (cfg.holeRadius / box.w) * 100;
  const ry = (cfg.holeRadius / box.h) * 100;
  const nH = Math.max(2, Math.round(box.w / cfg.holePitch));
  const nV = Math.max(2, Math.round(box.h / cfg.holePitch));

  const notches: { cx: number; cy: number }[] = [];
  for (let i = 0; i < nH; i++) {
    const t = (i + 0.5) / nH;
    notches.push({ cx: t * 100, cy: 0 });
    notches.push({ cx: t * 100, cy: 100 });
  }
  for (let i = 0; i < nV; i++) {
    const t = (i + 0.5) / nV;
    notches.push({ cx: 0, cy: t * 100 });
    notches.push({ cx: 100, cy: t * 100 });
  }

  return (
    <g ref={ref}>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {notches.map((n, i) => (
            <ellipse key={i} cx={n.cx} cy={n.cy} rx={rx} ry={ry} fill="black" />
          ))}
        </mask>
      </defs>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" mask={`url(#${maskId})`} />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="0" y="0" width="100" height="100" mask={`url(#${maskId})`} />
      )}
      {focused && (
        <rect className="badge-focus" x="-4" y="-4" width="108" height="108" mask={`url(#${maskId})`} />
      )}
    </g>
  );
}

// Avoid unused warning while keeping useEffect imported elsewhere if needed in future.
void useEffect;

const Perforated: ShapeModule<PerforatedParams> = {
  Component: PerforatedComponent,
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Perforated;
