import { useEffect, useRef } from 'react';
import { Transport } from '../passthrough/weasel-ui';
import { useTrialClock } from './hooks';
import { useTransportControl } from './useTransportControl';
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
  const control = useTransportControl(trialId);
  const root = useRef<HTMLDivElement | null>(null);
  useTransportKeys(root, control, keys);

  const touched = control?.touched ?? false;
  const speed = control?.speed;
  const ended = clock?.ended ?? false;
  useEffect(() => {
    if (replay === undefined || touched || !ended || !clock?.seekable || speed === undefined)
      return;
    const id = setTimeout(() => {
      clock.seek(0);
      clock.rate = speed;
    }, replay);
    return () => clearTimeout(id);
  }, [replay, touched, ended, clock, speed]);

  if (!clock || !control) return null;
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
        start={control.start}
        playhead={control.playhead}
        duration={control.length}
        onPlay={control.play}
        onPause={control.pause}
        onLoopChange={(loop: boolean | number) => {
          control.touch();
          // eslint-disable-next-line react-hooks/immutability -- the clock's loop is set by assignment
          clock.loop = loop;
        }}
        onRateChange={control.setSpeed}
        {...(control.scrubs
          ? {
              onSeek: control.seek,
              reverse: control.backward,
              onReverseChange: control.setBackward,
            }
          : {})}
      />
    </div>
  );
}
