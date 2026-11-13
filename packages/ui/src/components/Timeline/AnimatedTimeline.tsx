import { useCallback, useMemo, type ReactElement } from 'react';
import { useNotified } from '@weasel-js/react';
import { type TimelineHandle, type Track } from '@weasel-js/animator';
import { Timeline, type TimelineProps } from './Timeline';
import { Transport, type TransportProps } from './Transport';
import { useTimelinePlayback } from './useTimelinePlayback';

/** Props for {@link AnimatedTimeline}: `<Timeline>`'s, less what it reads off `handle`. */
export interface AnimatedTimelineProps
  extends Omit<TimelineProps, 'tracks' | 'duration' | 'playhead' | 'onChange' | 'onScrub' | 'transport'> {
  handle: TimelineHandle;
  /** `false` hides the transport, as on `<Timeline>`. */
  transport?: false;
}

/** Binds `<Timeline>` to a live handle.
 *
 *  `handle.tracks()` returns the timeline's own array, not a copy, so an edit
 *  splices it in place inside `edit()`. Assigning a replacement array would
 *  update nothing and raise nothing. */
export function AnimatedTimeline(props: AnimatedTimelineProps): ReactElement {
  const { handle, ...rest } = props;
  const { playhead, duration, onSeek, ...transport } = useTimelinePlayback(handle);

  // `subscribe` fires on `edit` only, so the playhead comes from the frame loop.
  const edits = useNotified(handle);
  // `<Timeline>` tells one track list from the next by identity, and the handle
  // edits its array in place, so every edit hands over a fresh copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `edits` is the signal
  const tracks = useMemo(() => handle.tracks().slice(), [handle, edits]);

  const onChange = useCallback((next: Track[]) => {
    handle.edit(() => {
      const live = handle.tracks() as Track[];
      live.splice(0, live.length, ...next);
    });
  }, [handle]);

  return (
    <Timeline
      {...rest}
      tracks={tracks}
      duration={duration}
      playhead={playhead}
      onChange={onChange}
      onScrub={onSeek}
      transport={props.transport === false ? false : transport}
    />
  );
}

/** Props for {@link AnimatedTransport}: `<Transport>`'s presentation, less what it reads off `handle`. */
export interface AnimatedTransportProps extends Pick<TransportProps, 'rates' | 'formatRate'> {
  handle: TimelineHandle;
  /** `false` leaves out the scrub bar. */
  scrub?: false;
}

/** `<Transport>` bound to a live handle: play and pause, loop, rate, and a scrub bar that seeks it,
 *  each written to the handle, and the playhead read from it every frame it moves. */
export function AnimatedTransport({ handle, scrub, ...rest }: AnimatedTransportProps): ReactElement {
  const { onSeek, ...playback } = useTimelinePlayback(handle);
  return <Transport {...rest} {...playback} onSeek={scrub === false ? undefined : onSeek} />;
}
