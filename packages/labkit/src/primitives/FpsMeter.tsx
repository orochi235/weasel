import { useEffect, useRef, useState } from 'react';
import { rollingAverage } from './fpsAverage';

const SAMPLE_WINDOW = 30;

export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    const tick = (time: number) => {
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
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="lk-fps-meter">
      <span className="lk-fps-meter-value">FPS {fps}</span>
    </div>
  );
}
