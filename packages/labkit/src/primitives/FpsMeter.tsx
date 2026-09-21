import { useVisibleRaf } from '@weasel-js/core';
import { useEffect, useRef, useState } from 'react';
import { rollingAverage } from './fpsAverage';

const SAMPLE_WINDOW = 30;

/** A live frame-rate readout, averaged over the last 30 frames. */
export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loop = useVisibleRaf(
    (time) => {
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
    <div className="lk-fps-meter" ref={rootRef}>
      <span className="lk-fps-meter-label">FPS</span>
      {/* The number is its own cell because it is the only part that changes:
          in one box with the label, every digit it gains or loses resizes the
          readout, and the status bar it sits in wraps to a second line and
          back — which in a small trial resizes the window. */}
      <span className="lk-fps-meter-value">{fps}</span>
    </div>
  );
}
