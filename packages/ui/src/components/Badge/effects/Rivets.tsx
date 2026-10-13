import type { EffectModule } from '../bases/types';
import type { BadgeCorner } from '../types';

/** What an effect of type `rivets` takes as `params`. */
export interface BadgeRivetsEffectParams {
  /** Rivet radius in CSS px. */
  radius?: number;
  /** Inset from each corner in CSS px. */
  inset?: number;
  /** Light origin (drives which side of each rivet gets the highlight). */
  lightFrom?: BadgeCorner;
}

const DEFAULTS: Required<BadgeRivetsEffectParams> = { radius: 2.4, inset: 7, lightFrom: 'tl' };

const Rivets: EffectModule<BadgeRivetsEffectParams> = {
  Component: ({ boxW, boxH, variant, params }) => {
    if (variant !== 'solid' && variant !== 'subtle') return null;
    const cfg = { ...DEFAULTS, ...params };
    const sx = 100 / boxW, sy = 100 / boxH;
    const rx = cfg.radius * sx;
    const ry = cfg.radius * sy;
    const ix = cfg.inset * sx;
    const iy = cfg.inset * sy;
    const litDx = cfg.lightFrom[1] === 'l' ? -cfg.radius * 0.32 : cfg.radius * 0.32;
    const litDy = cfg.lightFrom[0] === 't' ? -cfg.radius * 0.32 : cfg.radius * 0.32;
    const positions: [number, number][] = [
      [ix, iy],
      [100 - ix, iy],
      [ix, 100 - iy],
      [100 - ix, 100 - iy],
    ];
    return (
      <>
        {positions.map(([cx, cy], i) => (
          <g key={i}>
            <ellipse className="badge-bevel-dark"        cx={cx} cy={cy} rx={rx} ry={ry} />
            <ellipse className="badge-bevel-medium-dark" cx={cx - litDx * 0.6 * sx} cy={cy - litDy * 0.6 * sy} rx={rx * 0.75} ry={ry * 0.75} />
            <ellipse className="badge-bevel-light"       cx={cx + litDx * sx} cy={cy + litDy * sy} rx={rx * 0.45} ry={ry * 0.45} />
          </g>
        ))}
      </>
    );
  },
  zone: 'foreground',
  defaults: DEFAULTS,
};

export default Rivets;
