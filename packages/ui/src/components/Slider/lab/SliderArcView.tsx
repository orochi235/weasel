import { useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { arcShape, type TrackShape } from '@weasel-js/geom';
import { Along, arcInBox } from '@weasel-js/ui/components/Along';
import { Slider, type SliderProps, type Thumb } from '@weasel-js/ui/components/Slider';
import { num, Readouts, type Readout } from '../../Along/lab/Readouts';
import { Presets } from '../../Along/lab/Presets';
import lab from '../../Along/lab/lab.stories.module.css';
import { arcOf, SLIDER_ARC_PRESETS, spreadThumbs, twinProps, type SliderArcConfig, type SliderArcPreset } from './sliderArcSchema';
import { useTwinMeasure, type TwinReading } from './useTwinMeasure';
import s from './SliderArc.stories.module.css';

type Twin = 'curved' | 'straight';

/** Each twin's thumbs, one list for both while they are linked, started over when the range or count changes. */
function useTwinThumbs(c: SliderArcConfig) {
  const { min, max, step, thumbs: n, link } = c.values;
  const reset = `${min}|${max}|${step}|${n}`;
  const [state, setState] = useState(() => ({ reset, curved: spreadThumbs(n, min, max, step), straight: spreadThumbs(n, min, max, step) }));
  const current = state.reset === reset ? state : { reset, curved: spreadThumbs(n, min, max, step), straight: spreadThumbs(n, min, max, step) };
  if (current !== state) setState(current);
  const shape = c.look.thumbShape;
  const of = (twin: Twin): Thumb[] => (link ? current.curved : current[twin]).map((t) => ({ ...t, shape }));
  const set = (twin: Twin) => (next: Thumb[]) =>
    setState((prev) => (link ? { ...prev, curved: next, straight: next } : { ...prev, [twin]: next }));
  return { of, set };
}

function rows(reading: TwinReading, twin: Twin): Readout[] {
  const out: Readout[] = [];
  reading.thumbs.forEach((t, i) => {
    const n = reading.thumbs.length > 1 ? ` ${i + 1}` : '';
    out.push({ id: `${twin}-value-${i}`, label: `value${n}`, value: t.value });
    if (t.spoken) out.push({ id: `${twin}-spoken-${i}`, label: `spoken${n}`, value: t.spoken });
    out.push({ id: `${twin}-angle-${i}`, label: `turned${n}`, value: `${num(t.angle, 7, 1)}°` });
    if (t.off !== null) out.push({ id: `${twin}-off-${i}`, label: `off the arc${n}`, value: `${num(t.off, 7, 1)} px`, bad: t.off > 1 });
  });
  out.push({ id: `${twin}-labels`, label: 'stop labels', value: String(reading.labels) });
  out.push({ id: `${twin}-readouts`, label: 'readouts', value: String(reading.readouts) });
  return out;
}

/**
 * Every Slider prop on an arc, beside a straight twin given the same props: the curved twin lies along an `Along`,
 * the straight one runs as long as the arc. The readouts are read off the page — each thumb's published value and
 * spoken text, how far it is turned, and how far the curved one's center sits off the arc — so a difference between
 * the twins is a difference in what they do, not in what the lab asked of them.
 */
export function SliderArcView({ config, onPreset }: { config: SliderArcConfig; onPreset: (preset: SliderArcPreset) => void }): ReactElement {
  const props = twinProps(config);
  const { of, set } = useTwinThumbs(config);
  const { start, end, direction, inset, size } = config.arc;
  const arc = useMemo(() => arcOf({ start, end, direction, inset }), [start, end, direction, inset]);
  const shape: TrackShape = useMemo(() => arcShape(arcInBox(arc, { width: size, height: size })), [arc, size]);
  const curvedRoot = useRef<HTMLDivElement>(null);
  const straightRoot = useRef<HTMLDivElement>(null);
  const curved = useTwinMeasure(curvedRoot, shape);
  const straight = useTwinMeasure(straightRoot, null);
  const agree = curved.thumbs.length === straight.thumbs.length && curved.thumbs.every((t, i) => t.value === straight.thumbs[i]!.value);

  const addRemove = (twin: Twin): Partial<SliderProps> =>
    config.behavior.addRemove ? { onAddThumb: (value) => ({ value, shape: config.look.thumbShape }), onRemoveThumb: () => of(twin).length > 1 } : {};
  const vars = { '--box': `${size}px`, '--run': `${Math.round(shape.length)}px` } as CSSProperties;

  return (
    <div className={lab.lab}>
      <div className={`${lab.stack} ${lab.main}`} style={vars}>
        <section className={lab.section} aria-label="Curved">
          <h3 className={lab.sectionTitle}>Along the arc</h3>
          <div ref={curvedRoot} className={s.box} data-twin="curved">
            <Along arc={arc}>
              <Slider {...props} {...addRemove('curved')} ariaLabel="Curved" thumbs={of('curved')} onInput={set('curved')} />
            </Along>
          </div>
        </section>
        <section className={lab.section} aria-label="Straight">
          <h3 className={lab.sectionTitle}>Straight, as long as the arc</h3>
          <div ref={straightRoot} className={s.line} data-twin="straight">
            <Slider {...props} {...addRemove('straight')} ariaLabel="Straight" thumbs={of('straight')} onInput={set('straight')} />
          </div>
        </section>
        <Presets presets={SLIDER_ARC_PRESETS} onLoad={onPreset} />
      </div>
      <div className={`${lab.stack} ${lab.side}`}>
        <Readouts title="Twins" rows={[{ id: 'agree', label: 'same values', value: agree ? 'yes' : 'no', bad: !agree }, { id: 'run', label: 'arc length', value: `${num(shape.length)} px` }]} />
        <Readouts title="Curved" rows={rows(curved, 'curved')} />
        <Readouts title="Straight" rows={rows(straight, 'straight')} />
      </div>
    </div>
  );
}
