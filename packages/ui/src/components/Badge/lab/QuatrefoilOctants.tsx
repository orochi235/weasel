import { quatrefoilRadius, type BadgeQuatrefoilBaseParams } from '../bases/Quatrefoil';
import s from './QuatrefoilOctants.stories.module.css';

const STEPS = 96;
const OCTANT = Math.PI / 4;
const AXIS = 75;

interface Sweep {
  param: keyof BadgeQuatrefoilBaseParams;
  values: number[];
  title?: string;
  format?: (v: number) => string;
}

const twoPlaces = (v: number): string => v.toFixed(2);

const SWEEPS: Sweep[] = [
  { param: 'spikeCurvature', values: [0.4, 0.7, 1, 1.5, 2.5, 4] },
  { param: 'spikeBend', values: [-0.8, -0.4, 0, 0.4, 0.8], format: twoPlaces },
  { param: 'spikeTipErosion', values: [0, 0.2, 0.4, 0.6, 0.85], format: twoPlaces },
  { param: 'valleyAt', values: [0.15, 0.3, 0.5, 0.7, 0.85], format: twoPlaces },
  { param: 'valleyR', values: [5, 15, 25, 35, 45] },
  { param: 'valleySmooth', values: [0, 1.5, 3, 6, 12] },
  { param: 'lobeCurvature', values: [0.4, 0.7, 1, 1.5, 2.5, 4] },
  { param: 'lobeBend', values: [-0.8, -0.4, 0, 0.4, 0.8], format: twoPlaces },
  { param: 'lobeTipErosion', values: [0, 0.2, 0.4, 0.6, 0.85], format: twoPlaces },
  { param: 'lobeR', values: [25, 42, 55, 65, 70], title: 'lobeR (peak radius)' },
  { param: 'spikeR', values: [15, 25, 35, 45, 50], title: 'spikeR (tip radius)' },
];

/** One octant of the quatrefoil curve, from the cardinal axis (east) up to the diagonal. */
function OctantCell({ params, label }: { params: BadgeQuatrefoilBaseParams; label: string }) {
  const radiusAt = quatrefoilRadius(params);
  const points = Array.from({ length: STEPS + 1 }, (_, i) => {
    const theta = (i / STEPS) * OCTANT;
    const r = radiusAt(Math.sin(2 * theta));
    return `${(r * Math.cos(theta)).toFixed(2)},${(-r * Math.sin(theta)).toFixed(2)}`;
  });
  return (
    <div className={s.cell}>
      <svg viewBox="-5 -80 90 85" width={100} height={100} className={s.plot}>
        <line x1="0" y1="0" x2="75" y2="0" className={s.axis} strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="0" x2={(AXIS * Math.cos(OCTANT)).toFixed(2)} y2={(-AXIS * Math.sin(OCTANT)).toFixed(2)} className={s.axis} strokeWidth="0.5" strokeDasharray="2 2" />
        <polyline points={points.join(' ')} className={s.curve} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <circle cx="0" cy="0" r="1.2" className={s.origin} />
      </svg>
      <code className={s.cellLabel}>{label}</code>
    </div>
  );
}

/** The octant curve redrawn across a range of each quatrefoil param in turn, every other param at its default. */
export function QuatrefoilOctantSweeps() {
  return (
    <div className={s.sweeps}>
      <p className={s.intro}>
        One octant of the quatrefoil curve. The horizontal dashed line is the cardinal axis (s = 0);
        the 45° dashed line is the diagonal axis (s = 1). All other params default; only the
        labeled param varies. Green polyline traces r(s) from cardinal to diagonal.
      </p>
      {SWEEPS.map(({ param, values, title, format }) => (
        <section key={param} className={s.sweep}>
          <h3 className={s.sweepTitle}>{title ?? param}</h3>
          <div className={s.cells}>
            {values.map((v) => (
              <OctantCell key={v} params={{ [param]: v } as BadgeQuatrefoilBaseParams} label={`${param} = ${format ? format(v) : v}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
