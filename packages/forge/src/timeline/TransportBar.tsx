import { Slider, Transport } from '@weasel-js/ui';
import { useSyncExternalStore } from 'react';
import type { Clock } from './clock';
import { formatSeconds } from './playheadUrl';
import { useTrialClock } from './trialClocks';
import './timeline.css';

/** A scrub bar across the clock's span, then `Transport`'s play, loop, rate and time readout. */
export function TransportBar({ clock }: { clock: Clock }) {
  const { time, playing, loop, rate, span } = useSyncExternalStore(clock.subscribe, clock.get);
  return (
    <div className="fg-transport">
      <Slider
        className="fg-transport__scrub"
        ariaLabel="Scrub"
        density="slim"
        readoutPlacement="none"
        min={span.start}
        max={span.end > span.start ? span.end : span.start + 1}
        thumbs={[{ value: time, valueText: `${formatSeconds(time)} seconds` }]}
        onInput={([thumb]) => {
          if (thumb) clock.seek(thumb.value);
        }}
      />
      <Transport
        paused={!playing}
        loop={loop}
        rate={rate}
        playhead={time}
        duration={span.end}
        onPlay={clock.play}
        onPause={clock.pause}
        onLoopChange={(next) => clock.setLoop(next !== false && next !== 0)}
        onRateChange={clock.setRate}
      />
    </div>
  );
}

/** The transport of the clock trial `trialId`'s story published; nothing until it has. */
export function TrialTransport({ trialId }: { trialId: string }) {
  const clock = useTrialClock(trialId);
  return clock ? <TransportBar clock={clock} /> : null;
}
