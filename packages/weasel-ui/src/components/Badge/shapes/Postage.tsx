import { useLayoutEffect, useRef, useState } from 'react';
import type { ShapeModule } from '../types';

export interface PostageParams {
  biteRadius?: number;
  biteSpacing?: number;
  cornerGuard?: number;
  irregularity?: number;
}

const DEFAULTS: Required<PostageParams> = { biteRadius: 3, biteSpacing: 8, cornerGuard: 4, irregularity: 0 };

function biteCenters(edgeLen: number, biteRadius: number, biteSpacing: number, cornerGuard: number): number[] {
  const available = edgeLen - 2 * cornerGuard;
  if (available < 2 * biteRadius) return [];
  const n = Math.floor(available / biteSpacing) + 1;
  if (n <= 0) return [];
  const totalSpan = (n - 1) * biteSpacing;
  const startOffset = cornerGuard + (available - totalSpan) / 2;
  const result: number[] = [];
  for (let i = 0; i < n; i++) result.push(startOffset + i * biteSpacing);
  return result;
}

function PostageComponent({ variant, focused, params }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: PostageParams;
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

  const br = Math.max(0.5, cfg.biteRadius);
  const bs = Math.max(2 * br + 0.5, cfg.biteSpacing);
  const cg = Math.max(0, cfg.cornerGuard);
  const irr = Math.max(0, Math.min(cfg.irregularity, 1));
  const jitter = (i: number) => 1 + irr * 0.55 * Math.sin(i * 1.73 + 0.7);
  const rx = (br / box.w) * 100;
  const ry = (br / box.h) * 100;

  const topCenters = biteCenters(box.w, br, bs, cg).map(c => (c / box.w) * 100);
  const rightCenters = biteCenters(box.h, br, bs, cg).map(c => (c / box.h) * 100);
  const bottomCenters = biteCenters(box.w, br, bs, cg).map(c => (c / box.w) * 100);
  const leftCenters = biteCenters(box.h, br, bs, cg).map(c => (c / box.h) * 100);

  let d = `M 0 0`;
  topCenters.forEach((c, i) => {
    const j = jitter(i);
    d += ` L ${(c - rx).toFixed(3)} 0`;
    d += ` A ${(rx * j).toFixed(3)} ${(ry * j).toFixed(3)} 0 0 0 ${(c + rx).toFixed(3)} 0`;
  });
  d += ` L 100 0`;
  rightCenters.forEach((c, i) => {
    const j = jitter(i + 100);
    d += ` L 100 ${(c - ry).toFixed(3)}`;
    d += ` A ${(rx * j).toFixed(3)} ${(ry * j).toFixed(3)} 0 0 0 100 ${(c + ry).toFixed(3)}`;
  });
  d += ` L 100 100`;
  bottomCenters.forEach((c, i) => {
    const j = jitter(i + 200);
    const cr = 100 - c;
    d += ` L ${(cr + rx).toFixed(3)} 100`;
    d += ` A ${(rx * j).toFixed(3)} ${(ry * j).toFixed(3)} 0 0 0 ${(cr - rx).toFixed(3)} 100`;
  });
  d += ` L 0 100`;
  leftCenters.forEach((c, i) => {
    const j = jitter(i + 300);
    const cb = 100 - c;
    d += ` L 0 ${(cb + ry).toFixed(3)}`;
    d += ` A ${(rx * j).toFixed(3)} ${(ry * j).toFixed(3)} 0 0 0 0 ${(cb - ry).toFixed(3)}`;
  });
  d += ' Z';

  return (
    <g ref={ref}>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.04) translate(-50 -50)" />
      )}
    </g>
  );
}

const Postage: ShapeModule<PostageParams> = {
  Component: PostageComponent,
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Postage;
