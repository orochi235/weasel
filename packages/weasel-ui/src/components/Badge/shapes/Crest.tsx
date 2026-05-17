import type { ShapeModule } from '../types';

export interface CrestParams {
  topInset?: number;
  pointDepth?: number;
}

const DEFAULTS: Required<CrestParams> = { topInset: 12, pointDepth: 100 };

function crestPath(topInset: number, pointDepth: number) {
  const ti = Math.max(0, Math.min(topInset, 35));
  const pd = Math.max(60, Math.min(pointDepth, 110));
  // 5-sided shield silhouette with rounded shoulders and a bottom point.
  return [
    `M ${ti} 6`,
    `Q ${ti / 2} 0 ${ti + 4} 0`,
    `L ${100 - ti - 4} 0`,
    `Q ${100 - ti / 2} 0 ${100 - ti} 6`,
    `L ${100 - ti * 0.4} ${pd * 0.35}`,
    `Q ${100 - ti} ${pd * 0.7} 50 ${pd}`,
    `Q ${ti} ${pd * 0.7} ${ti * 0.4} ${pd * 0.35}`,
    'Z',
  ].join(' ');
}

const Crest: ShapeModule<CrestParams> = {
  Component: ({ variant, focused, params }) => {
    const cfg = { ...DEFAULTS, ...params };
    const d = crestPath(cfg.topInset, cfg.pointDepth);
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
        {focused && (
          <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />
        )}
      </>
    );
  },
  insets: { top: 4, right: 10, bottom: 14, left: 10 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Crest;
