import { useState, type CSSProperties, type ReactElement } from 'react';
import { arcShape, trackRun, wrapPositive } from '@weasel-js/geom';
import { Along, arcInBox, type AlongArc } from '@weasel-js/ui/components/Along';
import { Bar } from '@weasel-js/ui/components/Bar';
import { range as rangeSweep, Sequence, type Sweep as SweepOf } from '@weasel-js/ui/components/Sequence';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { actionsSchema, LabActions } from './labActions';
import s from './lab.stories.module.css';
import c from './ClockSweep.stories.module.css';

/** The knobs the lab reads. */
export interface ClockSweepConfig {
  /** Degrees each arc spans, centered on its hour. */
  span: number;
  /** Px across each dial. */
  size: number;
  /** Degrees each side of 3 and 9 o'clock the fine sweep covers. */
  fineRange: number;
  fineStep: number;
  show: 'both' | 'bar' | 'slider';
}

const BAR_INSET = 16;
const SLIDER_INSET = 64;
const STOPS = [0, 5, 10].map((v) => ({ value: v, label: String(v) }));
const BAR = actionsSchema(3, 'Sweep');
const HOURS = rangeSweep({ from: 0, to: 330, step: 30 });

/** The arc `span` degrees long centered on bearing `at`, `inset` px in from the dial's rim. */
export function sweepArc(at: number, span: number, inset: number): AlongArc {
  return { start: wrapPositive(at - span / 2, 360), end: wrapPositive(at + span / 2, 360), inset };
}

/** `trackRun`'s verdict on the bar's arc of a dial `size` px across: what the dial's caption says. */
export function verdictAt(at: number, span: number, size: number): { flipped: boolean; reversed: boolean } {
  const run = trackRun(arcShape(arcInBox(sweepArc(at, span, BAR_INSET), { width: size, height: size })));
  return { flipped: run.flipped, reversed: run.reversed };
}

const degrees = (at: number): string => (Number.isInteger(at) ? `${at}°` : `${at.toFixed(1)}°`);

/** One dial: a bar along its outer ring and a slider along its inner one, both centered on bearing `at`. */
function Dial({ at, config }: { at: number; config: ClockSweepConfig }): ReactElement {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 3 }]);
  const { flipped, reversed } = verdictAt(at, config.span, config.size);
  const label = degrees(at);
  return (
    <div
      className={c.dial}
      style={{ '--dial-size': `${config.size}px` } as CSSProperties}
      data-sweep-at={at}
      data-flipped={flipped}
      data-reversed={reversed}
    >
      {config.show !== 'slider' && (
        <Along arc={sweepArc(at, config.span, BAR_INSET)}>
          <Bar label={`Bar at ${label}`} schema={BAR} />
        </Along>
      )}
      {config.show !== 'bar' && (
        <Along arc={sweepArc(at, config.span, SLIDER_INSET)}>
          <Slider aria-label={`Slider at ${label}`} min={0} max={10} stops={STOPS} trackHeight={6} thumbs={thumbs} onInput={setThumbs} />
        </Along>
      )}
    </div>
  );
}

/** The dials over `bearings`, each captioned with `trackRun`'s verdict on its arc. */
function Sweep({ title, bearings, config }: { title: string; bearings: SweepOf<number>; config: ClockSweepConfig }): ReactElement {
  const caption = (raw: number): string => {
    const at = wrapPositive(raw, 360);
    const { flipped, reversed } = verdictAt(at, config.span, config.size);
    return `${degrees(at)} · ${flipped ? 'flipped' : 'upright'}${reversed ? ' · reversed' : ''}`;
  };
  return (
    <section className={s.section} aria-label={title}>
      <h3 className={s.sectionTitle}>{title}</h3>
      <Sequence label={title} sweep={bearings} caption={caption}>
        {(raw) => <Dial at={wrapPositive(raw, 360)} config={config} />}
      </Sequence>
    </section>
  );
}

/** Bearings from `mid - range` to `mid + range`, `step` apart, `mid` always among them; unwrapped. */
export function fineBearings(mid: number, range: number, step: number): SweepOf<number> {
  const reach = Math.floor(range / step) * step;
  return rangeSweep({ from: mid - reach, to: mid + reach, step });
}

/**
 * A bar and a slider centered on every hour of the clock, and finely either side of 3 and 9 o'clock, where an arc's
 * middle passes from pointing up to pointing down and `trackRun` turns its items over. Each dial's caption is
 * `trackRun`'s verdict on its arc; the items themselves show what the controls did with it, each item that reads
 * turned upright on its own where the run would stand it upside down.
 */
export function ClockSweepView({ config }: { config: ClockSweepConfig }): ReactElement {
  return (
    <LabActions>
      <div className={c.lab}>
        <Sweep title="Every 30°" bearings={HOURS} config={config} />
        <Sweep title="Near 3 o'clock" bearings={fineBearings(90, config.fineRange, config.fineStep)} config={config} />
        <Sweep title="Near 9 o'clock" bearings={fineBearings(270, config.fineRange, config.fineStep)} config={config} />
      </div>
    </LabActions>
  );
}
