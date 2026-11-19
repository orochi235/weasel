import { useEffect, useReducer, useRef, useState } from 'react';
import { createClock, createClockRegistry, type Clock } from '@weasel-js/clock';
import { useClockLoop } from '@weasel-js/clock/react';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './ClockDemo.module.css';

const PASS_MS = 3000;

const RATES = [-1, 0, 0.5, 1, 2].map((value) => ({ value, label: `${value}×` }));

const setRate = (clock: Clock, rate: number) => {
  clock.rate = rate;
};

export function ClockDemo() {
  const [registry] = useState(() => createClockRegistry());
  const [handle] = useState(() => createClock({ duration: PASS_MS, loop: true, rate: 1 }));
  const { clock } = handle;
  const track = useRef<HTMLDivElement>(null);
  // Registered with the track as its target, so the loop stops advancing it while it is scrolled away.
  useEffect(() => registry.register('demo', handle, () => track.current), [registry, handle]);
  useClockLoop(registry);

  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const offFrame = handle.onFrame(redraw);
    const offChange = clock.subscribe(redraw);
    return () => {
      offFrame();
      offChange();
    };
  }, [handle, clock]);

  const inPass = clock.phase * PASS_MS;

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <SegmentedBar
          aria-label="Rate"
          size="sm"
          items={RATES}
          value={RATES.some((r) => r.value === clock.rate) ? clock.rate : null}
          onChange={(v) => v !== null && setRate(clock, v)}
        />
        <Button size="sm" onClick={() => clock.ramp(0, 1000)}>Ease to a stop</Button>
      </div>
      <div ref={track}>
        <Slider
          aria-label="Time in pass"
          min={0}
          max={PASS_MS}
          step={1}
          thumbs={[{ value: inPass }]}
          onInput={(ts) => clock.seek(clock.pass * PASS_MS + ts[0]!.value)}
          readoutPlacement="none"
        />
      </div>
      <dl className={s.readout}>
        <dt>pass</dt>
        <dd className={s.num} data-testid="pass">{clock.pass}</dd>
        <dt>in pass</dt>
        <dd className={s.num} data-testid="in-pass">{inPass.toFixed(0)} ms</dd>
        <dt>rate</dt>
        <dd className={s.num}>{clock.rate.toFixed(2)}</dd>
      </dl>
    </div>
  );
}
