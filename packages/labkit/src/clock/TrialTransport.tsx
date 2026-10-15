import { useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { Transport } from '../passthrough/weasel-ui';
import { useTrialClock, useTrialClockHandle } from './hooks';
import { transportControl } from './transportControl';
import { type TransportHold, transportHoldOf } from './transportHold';
import { useTransportKeys } from './useTransportKeys';

const NO_SUBSCRIBE = () => () => {};
const NO_HOLD: TransportHold = { speed: 1, backward: false, touched: false };

/** Props for `<TrialTransport>`. */
export interface TrialTransportProps {
  /** The trial whose clock it plays, resolved as `useTrialClock` does: this
   *  trial's, else the one it renders inside, else the lab's focused trial's. */
  trialId?: string;
  /** Answer Space, the arrows, Home and End, R, and `<` / `>` anywhere on the
   *  page, except in a field or on another control. Default `false`. */
  keys?: boolean;
  /** Play a run that has ended again from the start after this many ms, until
   *  anyone works the clock from a transport. Omitted, an ended run stays ended. */
  replay?: number;
  /** How a speed reads, shown and spoken. Default a multiplier, `0.5x`. */
  formatRate?: (rate: number) => string;
  className?: string;
}

/**
 * weasel-ui's `<Transport>` bound to a trial clock: play and pause, speed and
 * loop, and — where the clock is seekable and has a duration — a scrub bar
 * over the current pass and a reverse switch. Renders nothing for a trial
 * without a clock.
 */
export function TrialTransport({
  trialId,
  keys = false,
  replay,
  formatRate,
  className,
}: TrialTransportProps) {
  const clock = useTrialClock(trialId);
  const handle = useTrialClockHandle(trialId);
  const [, frame] = useReducer((n: number) => n + 1, 0);
  useEffect(() => handle?.onFrame(frame), [handle]);

  const hold = clock ? transportHoldOf(clock) : null;
  const held = useSyncExternalStore(hold?.subscribe ?? NO_SUBSCRIBE, () => hold?.get() ?? NO_HOLD);
  const touch = (): void => hold?.touch();
  const control = clock && hold ? transportControl(clock, held, hold.set) : null;
  const root = useRef<HTMLDivElement | null>(null);
  useTransportKeys(root, control, keys, touch);

  const ended = clock?.ended ?? false;
  useEffect(() => {
    if (replay === undefined || held.touched || !ended || !clock?.seekable) return;
    const id = setTimeout(() => {
      clock.seek(0);
      clock.rate = held.speed;
    }, replay);
    return () => clearTimeout(id);
  }, [replay, held.touched, ended, clock, held.speed]);

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
        rates={clock.rates}
        {...(formatRate ? { formatRate } : {})}
        playhead={control.playhead}
        duration={control.length}
        onPlay={touching(control.play)}
        onPause={touching(control.pause)}
        onLoopChange={touching((loop: boolean | number) => {
          // eslint-disable-next-line react-hooks/immutability -- the clock's loop is set by assignment
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
