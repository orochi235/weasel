import { after } from '@weasel-js/registry';
import { Transport } from '@weasel-js/ui/components/Transport';
import { useEffect, useRef } from 'react';
import { useTrialClock, useTrialClockHandle } from './hooks';
import { playedOut, transportControl } from './transportControl';
import { transportHoldOf } from './transportHold';
import { useTransportControl } from './useTransportControl';
import { useTransportKeys } from './useTransportKeys';

/** Props for `<TrialTransport>`. */
export interface TrialTransportProps {
  /** The trial whose clock it plays, resolved as `useTrialClock` does: this
   *  trial's, else the one it renders inside, else the lab's focused trial's. */
  trialId?: string;
  /** Answer Space, the arrows, Home and End, R, and `<` / `>` on the page
   *  while focus is outside a field, a control and a canvas, which has keys
   *  of its own (the trial's, say). Default `false`. */
  keys?: boolean;
  /** Play a run that has played out again after this many ms, as Play would, until anyone works the clock from a
   *  transport. Omitted, a run that has played out stays where it stopped. */
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
  const control = useTransportControl(trialId);
  const root = useRef<HTMLDivElement | null>(null);
  useTransportKeys(root, control, keys);

  const touched = control?.touched ?? false;
  const out = clock !== null && control !== null && playedOut(clock, control.backward);
  useEffect(() => {
    if (replay === undefined || touched || !out || !clock) return;
    // Played as the transport's Play would, without marking the clock as worked by hand.
    return after(replay, () => {
      const hold = transportHoldOf(clock);
      transportControl(clock, hold.get(), hold.set, () => {}, handle?.reset).play();
    });
  }, [replay, touched, out, clock, handle]);

  if (!clock || !control) return null;
  return (
    <div
      ref={root}
      className={className ? `lk-trial-transport ${className}` : 'lk-trial-transport'}
    >
      <Transport
        playing={control.playing}
        loop={clock.loop}
        rate={control.speed}
        rates={clock.speeds}
        {...(formatRate ? { formatRate } : {})}
        start={control.start}
        playhead={control.playhead}
        duration={control.length}
        onPlayingChange={(next: boolean) => {
          if (next) control.play();
          else control.pause();
        }}
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
