import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ShapeModule } from '../types';

export type PlaqueCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface PlaqueParams {
  bevelWidth?: number;
  lightFrom?: PlaqueCorner;
  /** Rivet radius in CSS px. 0 hides the rivets. */
  rivetRadius?: number;
  /** Rivet inset from each corner in CSS px (centre offset). */
  rivetInset?: number;
}

const DEFAULTS: Required<PlaqueParams> = { bevelWidth: 6, lightFrom: 'tl', rivetRadius: 2.4, rivetInset: 7 };

interface BevelClasses {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function bevelClassesFor(lightFrom: PlaqueCorner): BevelClasses {
  const isTop = lightFrom[0] === 't';
  const isLeft = lightFrom[1] === 'l';
  return {
    top: isTop ? 'badge-bevel-light' : 'badge-bevel-dark',
    bottom: isTop ? 'badge-bevel-dark' : 'badge-bevel-light',
    left: isLeft ? 'badge-bevel-medium-light' : 'badge-bevel-medium-dark',
    right: isLeft ? 'badge-bevel-medium-dark' : 'badge-bevel-medium-light',
  };
}

// Gradient runs from the shadow corner (0%) to the lit corner (100%).
const FACE_COORDS: Record<PlaqueCorner, { x1: string; y1: string; x2: string; y2: string }> = {
  tl: { x1: '100%', y1: '100%', x2: '0%', y2: '0%' },
  tr: { x1: '0%', y1: '100%', x2: '100%', y2: '0%' },
  bl: { x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
  br: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
};

function PlaqueComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: PlaqueParams;
}) {
  const cfg = { ...DEFAULTS, ...params };
  const bw = Math.max(0, Math.min(cfg.bevelWidth, 25));
  const lightFrom: PlaqueCorner = cfg.lightFrom;
  const faceId = useId();
  const ref = useRef<SVGGElement>(null);
  const [box, setBox] = useState({ w: 100, h: 100 });
  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const update = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  const sx = 100 / box.w;
  const sy = 100 / box.h;
  const rivetRx = cfg.rivetRadius * sx;
  const rivetRy = cfg.rivetRadius * sy;
  const insetX = cfg.rivetInset * sx;
  const insetY = cfg.rivetInset * sy;
  const hasFill = variant === 'solid' || variant === 'subtle';
  const cls = bevelClassesFor(lightFrom);
  return renderPlaque({ hasFill, cfg, bw, lightFrom, faceId, cls, ref, rivetRx, rivetRy, insetX, insetY, sx, sy, variant, focused });
}

interface PlaqueRenderArgs {
  hasFill: boolean;
  cfg: Required<PlaqueParams>;
  bw: number;
  lightFrom: PlaqueCorner;
  faceId: string;
  cls: BevelClasses;
  ref: React.RefObject<SVGGElement | null>;
  rivetRx: number;
  rivetRy: number;
  insetX: number;
  insetY: number;
  sx: number;
  sy: number;
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
}

function renderPlaque({ hasFill, cfg, bw, lightFrom, faceId, cls, ref, rivetRx, rivetRy, insetX, insetY, sx, sy, variant, focused }: PlaqueRenderArgs) {
  return (
    <g ref={ref}>
      {hasFill && <rect className="badge-fill" x="0" y="0" width="100" height="100" />}
      {hasFill && (
        <>
          <defs>
            <linearGradient id={faceId} {...FACE_COORDS[lightFrom]}>
              <stop offset="0%" stopColor="black" stopOpacity="0.22" />
              <stop offset="45%" stopColor="black" stopOpacity="0.04" />
              <stop offset="58%" stopColor="white" stopOpacity="0.04" />
              <stop offset="100%" stopColor="white" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill={`url(#${faceId})`} style={{ pointerEvents: 'none' }} />
        </>
      )}
      {hasFill && bw > 0 && (
        <>
          <polygon className={cls.top} points={`0,0 100,0 ${100 - bw},${bw} ${bw},${bw}`} />
          <polygon className={cls.left} points={`0,100 0,0 ${bw},${bw} ${bw},${100 - bw}`} />
          <polygon className={cls.right} points={`100,0 100,100 ${100 - bw},${100 - bw} ${100 - bw},${bw}`} />
          <polygon className={cls.bottom} points={`100,100 0,100 ${bw},${100 - bw} ${100 - bw},${100 - bw}`} />
        </>
      )}
      {cfg.rivetRadius > 0 && (
        <>
          {[
            [insetX, insetY],
            [100 - insetX, insetY],
            [insetX, 100 - insetY],
            [100 - insetX, 100 - insetY],
          ].map(([cx, cy], i) => {
            const litDxCss = lightFrom[1] === 'l' ? -cfg.rivetRadius * 0.32 : cfg.rivetRadius * 0.32;
            const litDyCss = lightFrom[0] === 't' ? -cfg.rivetRadius * 0.32 : cfg.rivetRadius * 0.32;
            return (
              <g key={i}>
                <ellipse className="badge-bevel-dark"        cx={cx} cy={cy} rx={rivetRx} ry={rivetRy} />
                <ellipse className="badge-bevel-medium-dark" cx={cx - litDxCss * 0.6 * sx} cy={cy - litDyCss * 0.6 * sy} rx={rivetRx * 0.75} ry={rivetRy * 0.75} />
                <ellipse className="badge-bevel-light"       cx={cx + litDxCss * sx} cy={cy + litDyCss * sy} rx={rivetRx * 0.45} ry={rivetRy * 0.45} />
              </g>
            );
          })}
        </>
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="1" y="1" width="98" height="98" />
      )}
      {focused && (
        <rect className="badge-focus" x="-3" y="-3" width="106" height="106" />
      )}
    </g>
  );
}

const Plaque: ShapeModule<PlaqueParams> = {
  Component: PlaqueComponent,
  insets: { top: 6, right: 8, bottom: 6, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Plaque;
