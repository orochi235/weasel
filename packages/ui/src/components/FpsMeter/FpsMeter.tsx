import { useVisibleRaf } from '@weasel-js/react';
import { useEffect, useRef, useState } from 'react';
import { rollingAverage } from './fpsAverage';
import s from './FpsMeter.module.css';

const SAMPLE_WINDOW = 30;

/** Props for `<FpsMeter>`. */
export interface FpsMeterProps {
  className?: string;
}

/** A live frame-rate readout, averaged over the last 30 frames. */
export function FpsMeter({ className }: FpsMeterProps) {
  const [fps, setFps] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loop = useVisibleRaf(
    (time, loop) => {
      const last = lastTimeRef.current;
      if (last !== null) {
        const delta = time - last;
        if (delta > 0) {
          const samples = samplesRef.current;
          samples.push(1000 / delta);
          if (samples.length > SAMPLE_WINDOW) samples.shift();
          setFps(rollingAverage(samples));
        }
      }
      lastTimeRef.current = time;
      loop.request();
    },
    {
      target: rootRef,
      // The gap spent suspended is not a frame that took an hour to draw.
      onResume: () => {
        lastTimeRef.current = null;
      },
    },
  );

  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);

  return (
    <div className={className ? `${s.meter} ${className}` : s.meter} ref={rootRef}>
      <span>FPS</span>
      {/* The number is its own cell because it is the only part that changes:
          in one box with the label, every digit it gains or loses resizes the
          readout, and the status bar it sits in wraps to a second line and
          back — which in a small trial resizes the window. */}
      <span className={s.value}>{fps}</span>
    </div>
  );
}
