import { useRef } from 'react';
import type { ShapeModule } from '../types';
import { useSvgBox } from '../useSvgBox';
import { lerp, trimNumber } from '@weasel-js/geom';

/** What `shapeParams` takes on a `shield` badge. */
export interface BadgeShieldShapeParams {
  pointDepth?: number;
  shoulderY?: number;
  curveTightness?: number;
  /** 0..1 fraction of max top-corner rounding. */
  erosion?: number;
}

const DEFAULTS: Required<BadgeShieldShapeParams> = {
  pointDepth: 100,
  shoulderY: 55,
  curveTightness: 0.7,
  erosion: 0.33,
};

function ShieldComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: BadgeShieldShapeParams;
}) {
  const cfg = { ...DEFAULTS, ...params };
  const ref = useRef<SVGGElement>(null);
  const box = useSvgBox(ref);

  const pd = Math.max(60, Math.min(cfg.pointDepth, 110));
  const sh = Math.max(20, Math.min(cfg.shoulderY, pd - 5));
  const cpY = lerp(sh, pd, Math.max(0.1, Math.min(cfg.curveTightness, 1)));
  // Aspect-aware top corner radii (so the rounded corners stay circular in CSS).
  const cornerCss = Math.max(0, Math.min(cfg.erosion, 1)) * 12;
  const rxC = (cornerCss / box.width) * 100;
  const ryC = (cornerCss / box.height) * 100;
  const d = [
    `M ${trimNumber(rxC, 3)} 0`,
    `L ${trimNumber(100 - rxC, 3)} 0`,
    `A ${trimNumber(rxC, 3)} ${trimNumber(ryC, 3)} 0 0 1 100 ${trimNumber(ryC, 3)}`,
    `L 100 ${sh}`,
    `Q 100 ${cpY} 50 ${pd}`,
    `Q 0 ${cpY} 0 ${sh}`,
    `L 0 ${trimNumber(ryC, 3)}`,
    `A ${trimNumber(rxC, 3)} ${trimNumber(ryC, 3)} 0 0 1 ${trimNumber(rxC, 3)} 0`,
    'Z',
  ].join(' ');
  return (
    <g ref={ref}>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />
      )}
    </g>
  );
}

const Shield: ShapeModule<BadgeShieldShapeParams> = {
  Component: ShieldComponent,
  insets: { top: 2, right: 8, bottom: 14, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Shield;
