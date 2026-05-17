import { useLayoutEffect, useRef, useState } from 'react';
import type { ShapeModule } from '../types';

export interface ShieldParams {
  pointDepth?: number;
  shoulderY?: number;
  curveTightness?: number;
  cornerRadius?: number;
}

const DEFAULTS: Required<ShieldParams> = {
  pointDepth: 100,
  shoulderY: 55,
  curveTightness: 0.7,
  cornerRadius: 4,
};

function ShieldComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: ShieldParams;
}) {
  const cfg = { ...DEFAULTS, ...params };
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

  const pd = Math.max(60, Math.min(cfg.pointDepth, 110));
  const sh = Math.max(20, Math.min(cfg.shoulderY, pd - 5));
  const cpY = sh + (pd - sh) * Math.max(0.1, Math.min(cfg.curveTightness, 1));
  // Aspect-aware top corner radii (so the rounded corners stay circular in CSS).
  const rxC = (cfg.cornerRadius / box.w) * 100;
  const ryC = (cfg.cornerRadius / box.h) * 100;
  const d = [
    `M ${rxC.toFixed(3)} 0`,
    `L ${(100 - rxC).toFixed(3)} 0`,
    `A ${rxC.toFixed(3)} ${ryC.toFixed(3)} 0 0 1 100 ${ryC.toFixed(3)}`,
    `L 100 ${sh}`,
    `Q 100 ${cpY} 50 ${pd}`,
    `Q 0 ${cpY} 0 ${sh}`,
    `L 0 ${ryC.toFixed(3)}`,
    `A ${rxC.toFixed(3)} ${ryC.toFixed(3)} 0 0 1 ${rxC.toFixed(3)} 0`,
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

const Shield: ShapeModule<ShieldParams> = {
  Component: ShieldComponent,
  insets: { top: 2, right: 8, bottom: 14, left: 8 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Shield;
