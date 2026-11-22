import { useId, useRef } from 'react';
import { clampParam, withDefaults } from './params';
import type { ShapeModule } from '../types';
import { useSvgBox } from '../useSvgBox';

/** What `shapeParams` takes on a `perforated` badge. */
export interface BadgePerforatedShapeParams {
  holeRadius?: number;
  holePitch?: number;
}

const DEFAULTS: Required<BadgePerforatedShapeParams> = { holeRadius: 3.5, holePitch: 11 };
/** The closest holes sit, in CSS px, so a tiny pitch cannot mint a hole per fraction of a pixel. */
const MIN_HOLE_PITCH = 1;

function PerforatedComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: BadgePerforatedShapeParams;
}) {
  const cfg = withDefaults(DEFAULTS, params);
  const maskId = useId();
  const ref = useRef<SVGGElement>(null);
  const box = useSvgBox(ref);

  // Convert CSS-px hole sizing into viewBox units so holes look circular on either axis.
  const holeRadius = clampParam(cfg.holeRadius, 0, Infinity, DEFAULTS.holeRadius);
  const rx = (holeRadius / box.width) * 100;
  const ry = (holeRadius / box.height) * 100;
  const pitch = Math.max(2 * holeRadius, clampParam(cfg.holePitch, MIN_HOLE_PITCH, Infinity, DEFAULTS.holePitch));
  const nH = Math.max(2, Math.round(box.width / pitch));
  const nV = Math.max(2, Math.round(box.height / pitch));

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

const Perforated: ShapeModule<BadgePerforatedShapeParams> = {
  Component: PerforatedComponent,
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Perforated;
