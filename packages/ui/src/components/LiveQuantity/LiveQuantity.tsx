import { holdEndOf, nextReading, readingAt, type Reading, type ReadingOptions } from '@weasel-js/clock';
import { nextChangeFor, tag, type Display, type Unit } from '@weasel-js/quantity';
import { useVisibleRaf } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFieldLocale } from '../../useFieldLocale';
import { QuantityText } from '../QuantityText';
import s from './LiveQuantity.module.css';

/** Props for {@link LiveQuantity}. */
export interface LiveQuantityProps extends ReadingOptions {
  /** The measurement, which runs on at its rate until the next one replaces it. */
  reading: Reading;
  /** How the value shows: a `duration`, `bytes`, `relative`, any display kind. */
  display?: Display;
  /** The unit the reading's value counts, which a time kind reads: `'ms'` for milliseconds. */
  unit?: Unit;
  /** BCP 47 locale. Default the number fields' locale. */
  locale?: string;
  /** Draw no copy for a screen reader, as {@link QuantityText}'s `mute`. */
  mute?: boolean;
  className?: string;
}

/** The reading followed, the one it was made from, and the host time the readout is drawn at. */
interface Followed {
  from: Reading;
  shown: Reading;
  now: number;
}

/** Host ms until `r`'s text under `display` next changes, counted from `now`. */
function wakeFor(r: Reading, now: number, display: Display | undefined, unit: Unit | undefined, locale: string): number {
  const options = { locale };
  const end = holdEndOf(r);
  if (end > now && r.hold !== undefined) return end - now + nextChangeFor(tag(r.hold, undefined, unit), r.rate, display, options);
  return nextChangeFor(tag(readingAt(r, now), undefined, unit), r.rate, display, options);
}

/**
 * A quantity that keeps moving between updates: an elapsed time, a countdown, a byte count, how long
 * ago something happened. Each `reading` re-anchors it; between them it runs on at the reading's
 * rate, and one that lands behind what is shown holds rather than counting back (`nextReading`).
 * It redraws only when its text changes, sleeping until then, and not at all while the page is
 * hidden or it is out of view. The figures sit at the end of a box that only widens, so a digit
 * gained never moves what is beside it.
 */
export function LiveQuantity({ reading, display, unit, locale: localeProp, mute, className, maxHold }: LiveQuantityProps) {
  const locale = useFieldLocale(localeProp);
  const box = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<Followed>(() => ({ from: reading, shown: nextReading(undefined, reading, { maxHold }), now: reading.at }));
  let current = state;
  if (state.from !== reading) {
    current = { from: reading, shown: nextReading(state.shown, reading, { maxHold }), now: Math.max(state.now, reading.at) };
    setState(current);
  }
  const { shown, now } = current;
  const loop = useVisibleRaf(() => {
    const t = performance.now();
    setState((s) => (t > s.now ? { ...s, now: t } : s));
  }, { target: box });

  useEffect(() => {
    // Drawn as of `now`; time has gone by since, and the wait counts from what was drawn.
    const since = performance.now() - now;
    return after(Math.max(0, wakeFor(shown, now, display, unit, locale) - since), loop.request);
  }, [shown, now, display, unit, locale, loop]);

  const widest = useRef(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    if (width <= widest.current) return;
    widest.current = width;
    // The one value no stylesheet can know: how wide the readout has been.
    el.style.setProperty('--live-quantity-widest', `${width}px`);
  });

  return (
    <span ref={box} className={[s.live, className].filter(Boolean).join(' ')}>
      <QuantityText value={tag(readingAt(shown, now), undefined, unit)} display={display} locale={locale} mute={mute} />
    </span>
  );
}
