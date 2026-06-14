import type { EffectModule } from '../bases/types';

export interface ShadowEffectParams {
  /** Offset in CSS px. */
  dx?: number;
  dy?: number;
  /** Alpha 0..1. */
  opacity?: number;
}

const DEFAULTS: Required<ShadowEffectParams> = { dx: 1, dy: 2, opacity: 0.28 };

const Shadow: EffectModule<ShadowEffectParams> = {
  Component: ({ sampler, boxW, boxH, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW, sy = 100 / boxH;
    const dxVb = cfg.dx * sx;
    const dyVb = cfg.dy * sy;
    return (
      <path
        d={sampler.bodyPath}
        transform={`translate(${dxVb.toFixed(3)} ${dyVb.toFixed(3)})`}
        fill={`rgba(0, 0, 0, ${Math.max(0, Math.min(cfg.opacity, 1))})`}
        stroke="none"
        style={{ pointerEvents: 'none' }}
      />
    );
  },
  zone: 'background',
  defaults: DEFAULTS,
};

export default Shadow;
