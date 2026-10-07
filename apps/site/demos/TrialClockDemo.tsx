import { defineInstrument, Lab, useClockFrame, useTrialClock } from '@weasel-js/labkit';
import { Button } from '@weasel-js/ui';
import { useRef } from 'react';
// In-repo, so the source stylesheet: a consumer imports the built
// `@weasel-js/labkit/styles.css` instead.
import '@weasel-js/labkit/styles.less';
import 'windease/styles.css';
import s from './TrialClockDemo.module.css';

const RADIUS = 160;

/** Play, pause and reverse through the trial's clock, and its time written
 *  per frame without re-rendering. */
function Controls() {
  const clock = useTrialClock();
  const readout = useRef<HTMLSpanElement>(null);
  useClockFrame((elapsed) => {
    if (readout.current) readout.current.textContent = `${(elapsed / 1000).toFixed(2)}s`;
  });
  if (!clock) return null;
  const forward = clock.rate >= 0;
  return (
    <div className={s.controls}>
      <Button onClick={() => { clock.rate = clock.rate === 0 ? 1 : 0; }}>
        {clock.rate === 0 ? 'Play' : 'Pause'}
      </Button>
      <Button onClick={() => { clock.rate = forward ? -1 : 1; }}>
        {forward ? 'Reverse' : 'Forward'}
      </Button>
      <span ref={readout} className={s.readout}>0.00s</span>
    </div>
  );
}

const orbit = defineInstrument({
  name: 'Orbit',
  initialState: () => ({}),
  defaultConfig: () => ({}),
  clock: { duration: 4000, loop: true },
  canvas: {
    initialView: (size) => ({ zoom: 1, pan: { x: size.width / 2, y: size.height / 2 } }),
    layers: [
      {
        id: 'track',
        draw: (ctx, { zoom }) => {
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
          ctx.stroke();
        },
      },
      {
        id: 'planet',
        timed: true,
        draw: (ctx, { phase }) => {
          const angle = phase * Math.PI * 2;
          ctx.fillStyle = '#8e4ec6';
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS, 14, 0, Math.PI * 2);
          ctx.fill();
        },
      },
    ],
  },
  render: () => <Controls />,
});

export function TrialClockDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Trial clock" instruments={[orbit]} defaultInstrument="Orbit" />
    </div>
  );
}
