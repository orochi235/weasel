import { useEffect, useReducer, useRef, useState } from 'react';
import { Transport } from '../passthrough/weasel-ui';
import { useTrialClock, useTrialClockHandle } from './hooks';
import { transportControl } from './transportControl';
import { useTransportKeys } from './useTransportKeys';

/** Props for `<TrialTransport>`. */
export interface TrialTransportProps {
  /** The trial whose clock it plays, resolved as `useTrialClock` does: this
   *  trial's, else the one it renders inside, else the lab's focused trial's. */
  trialId?: string;
  /** Answer Space, the arrows, Home and End, R, and `<` / `>` anywhere on the
   *  page, except in a field or on another control. Default `false`. */
  keys?: boolean;
  /** Play a run that has ended again from the start after this many ms, until
   *  anyone touches the transport. Omitted, an ended run stays ended. */
  replay?: number;
  className?: string;
}

/**
 * weasel-ui's `<Transport>` bound to a trial clock: play and pause, speed and
 * loop, and — where the clock is seekable and has a duration — a scrub bar
 * over the current pass and a reverse switch. Renders nothing for a trial
 * without a clock.
 */
export function TrialTransport({ trialId, keys = false, replay, className }: TrialTransportProps) {
  const clock = useTrialClock(trialId);
  const handle = useTrialClockHandle(trialId);
  const [, frame] = useReducer((n: number) => n + 1, 0);
  useEffect(() => handle?.onFrame(frame), [handle]);

  const [held, hold] = useState(() => ({
    speed: Math.abs(clock?.rate ?? 0) || 1,
    backward: (clock?.rate ?? 0) < 0,
  }));
  const [touched, setTouched] = useState(false);
  const touch = (): void => setTouched(true);
  const control = clock ? transportControl(clock, held, hold) : null;
  const root = useRef<HTMLDivElement | null>(null);
  useTransportKeys(root, control, keys, touch);

  const ended = clock?.ended ?? false;
  useEffect(() => {
    if (replay === undefined || touched || !ended || !clock?.seekable) return;
    const id = setTimeout(() => {
      clock.seek(0);
      clock.rate = held.speed;
    }, replay);
    return () => clearTimeout(id);
  }, [replay, touched, ended, clock, held.speed]);

  if (!clock || !control) return null;
  const touching =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A): void => {
      touch();
      fn(...args);
    };
  return (
    <div
      ref={root}
      className={className ? `lk-trial-transport ${className}` : 'lk-trial-transport'}
    >
      <Transport
        paused={!control.playing}
        loop={clock.loop}
        rate={control.speed}
        playhead={control.playhead}
        duration={control.length}
        onPlay={touching(control.play)}
        onPause={touching(control.pause)}
        onLoopChange={touching((loop: boolean | number) => {
          clock.loop = loop;
        })}
        onRateChange={touching(control.setSpeed)}
        {...(control.scrubs
          ? {
              onSeek: touching(control.seek),
              reverse: control.backward,
              onReverseChange: touching(control.setBackward),
            }
          : {})}
      />
    </div>
  );
}
