import { useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Along, arcInBox } from '@weasel-js/ui/components/Along';
import { createRecentColorsStore } from '@weasel-js/ui/components/RecentColors';
import { SwatchStrip } from '@weasel-js/ui/components/SwatchStrip';
import { num, Readouts, type Readout } from '../../Along/lab/Readouts';
import lab from '../../Along/lab/lab.stories.module.css';
import { palettesOf, recentColors, swatchArcOf, type SwatchArcConfig } from './swatchArcConfig';
import { useRingReading, type RingReading } from './useRingReading';
import s from './SwatchArc.stories.module.css';

function ringRows(rings: readonly RingReading[]): Readout[] {
  return rings.map((r) => ({
    id: `ring-${r.ring}`,
    label: `${r.ring} ${r.group}`,
    value: `${String(r.swatches).padStart(3, ' ')}  r ${num(r.radius, 6, 1)} ±${num(r.radiusSpread, 4, 2)}  step ${num(r.spacing, 5, 1)} ±${num(r.spacingSpread, 4, 2)}`,
    bad: r.radiusSpread > 1 || r.spacingSpread > 1,
  }));
}

/**
 * A swatch strip along an arc: the recent row and each palette row on a ring of its own, stacked in toward the arc's
 * center. The readouts are read off the page: each ring's radius and the spacing of its swatches, with how far they
 * stray, which should be under a pixel.
 */
export function SwatchArcView({ config }: { config: SwatchArcConfig }): ReactElement {
  const { center, sweep, direction, inset, size } = config.arc;
  const { palettes: which, recent, columns, align } = config.swatches;
  const arc = useMemo(() => swatchArcOf({ center, sweep, direction, inset }), [center, sweep, direction, inset]);
  const spec = useMemo(() => arcInBox(arc, { width: size, height: size }), [arc, size]);
  const store = useMemo(() => {
    const made = createRecentColorsStore({ storage: null });
    made.record(recentColors(recent).reverse());
    return made;
  }, [recent]);
  const palettes = useMemo(() => palettesOf(which), [which]);
  const [value, setValue] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const rings = useRingReading(root, spec.center);
  const vars = { '--box': `${size}px` } as CSSProperties;

  const summary: Readout[] = [
    { id: 'radius', label: 'arc radius', value: `${num(spec.radius, 6, 1)} px` },
    { id: 'rings', label: 'rings', value: String(rings.length) },
    { id: 'value', label: 'applied', value: value ?? '—' },
  ];

  return (
    <div className={lab.lab}>
      <div className={`${lab.stack} ${lab.main}`} style={vars}>
        <section className={lab.section} aria-label="Swatches">
          <h3 className={lab.sectionTitle}>Along the arc</h3>
          <div ref={root} className={s.box} data-lab-box>
            <Along arc={arc} align={align}>
              <SwatchStrip store={store} palettes={palettes} columns={columns} value={value} onChange={setValue} />
            </Along>
          </div>
        </section>
        <p className={lab.note}>
          Each row is a ring of its own. Each arrow moves to the neighbor that lies its way on screen, along a ring or across to the next. A ring too long for
          the arc scrolls along itself; rows past where the arc bends too tight share the last ring that fits.
        </p>
      </div>
      <div className={`${lab.stack} ${lab.side}`}>
        <Readouts title="Strip" rows={summary} />
        <Readouts title="Rings: swatches, radius, step along" rows={ringRows(rings)} />
      </div>
    </div>
  );
}
