import { useCallback, useEffect, useReducer, useRef, useState, type ReactElement } from 'react';
import { useVisibleRaf, type TimelineHandle, type Track } from '@weasel-js/core';
import { Timeline, type TimelineProps } from './Timeline';

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
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [loop, setLoopState] = useState<boolean | number>(false);
  const [rate, setRate] = useState(1);

  // `subscribe` fires on `edit` only, so the playhead comes from the frame loop.
  useEffect(() => handle.subscribe(bump), [handle]);

  // `useVisibleRaf` returns a controller; a continuous loop re-requests from
  // inside its own frame, and nothing runs until something calls `request`.
  // No `onResume` here: this loop measures no elapsed time of its own, it only
  // reads the playhead the animator already advanced.
  const rafRef = useRef<{ request(): void } | null>(null);
  const raf = useVisibleRaf(() => {
    bump();
    if (!handle.isPaused()) rafRef.current?.request();
  });
  rafRef.current = raf;
  useEffect(() => {
    if (!handle.isPaused()) raf.request();
    return () => raf.cancel();
  }, [handle, raf]);

  const onChange = useCallback((next: Track[]) => {
    handle.edit(() => {
      const live = handle.tracks() as Track[];
      live.splice(0, live.length, ...next);
    });
  }, [handle]);

  const playhead = handle.time();
  const duration = handle.duration();

  return (
    <Timeline
      {...rest}
      tracks={handle.tracks()}
      duration={duration}
      playhead={playhead}
      onChange={onChange}
      onScrub={handle.seek}
      transport={props.transport === false ? false : {
        paused: handle.isPaused(),
        loop,
        rate,
        onPlay: () => {
          // `rearm` declines to revive a timeline at its duration, so resume
          // alone would do nothing. Play-at-end rewinds first.
          if (handle.time() >= duration) handle.seek(0);
          handle.resume();
          raf.request();
          bump();
        },
        onPause: () => { handle.pause(); bump(); },
        onLoopChange: (next) => { handle.setLoop(next); setLoopState(next); },
        onRateChange: (next) => { handle.setTimeScale(next); setRate(next); },
      }}
    />
  );
}
