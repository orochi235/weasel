import { useEffect, useReducer } from 'react';
import { useVisibleRaf } from '@weasel-js/react';
import type { TimelineHandle } from '@weasel-js/animator';
import type { TransportProps } from './Transport';

/** Whether the playhead will move on its own. A timeline that ran to its end
 *  without looping still reports itself unpaused. */
function isAdvancing(handle: TimelineHandle): boolean {
  if (handle.isPaused()) return false;
  return handle.loop() !== false || handle.time() < handle.duration();
}

/** A live handle read as `<Transport>`'s props, rendering each frame the playhead moves. */
export function useTimelinePlayback(handle: TimelineHandle): Omit<TransportProps, 'onSeek'> & { onSeek: (t: number) => void } {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // A resume, pause, or seek made on the handle from elsewhere: the render it
  // asks for is what restarts the frame loop below.
  useEffect(() => handle.subscribePlayback(bump), [handle]);

  // No `onResume`: this loop measures no elapsed time of its own, it only reads
  // the playhead the animator already advanced.
  const raf = useVisibleRaf((_time, raf) => {
    bump();
    if (isAdvancing(handle)) raf.request();
  });
  // Every render, not only mount: an edit can lengthen a finished timeline and
  // set it running again, and `request` does nothing while a frame is pending.
  useEffect(() => {
    if (isAdvancing(handle)) raf.request();
  });
  useEffect(() => () => raf.cancel(), [handle, raf]);

  const duration = handle.duration();
  return {
    paused: !isAdvancing(handle),
    loop: handle.loop(),
    rate: handle.timeScale(),
    playhead: handle.time(),
    duration,
    onPlay: () => {
      // `rearm` declines to revive a timeline at its duration, so resume
      // alone would do nothing. Play-at-end rewinds first.
      if (handle.time() >= handle.duration()) handle.seek(0);
      handle.resume();
      raf.request();
    },
    onPause: () => { handle.pause(); },
    onLoopChange: (next) => { handle.setLoop(next); },
    onRateChange: (next) => { handle.setTimeScale(next); },
    onSeek: (t) => { handle.seek(t); },
  };
}
