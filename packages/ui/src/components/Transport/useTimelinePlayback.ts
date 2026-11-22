import { useEffect, useReducer } from 'react';
import { useVisibleRaf } from '@weasel-js/react';
import type { TimelineHandle } from '@weasel-js/animator';
import { loopsAgain, type TransportProps } from './Transport';

/** Whether the playhead will move on its own. A timeline that ran to the end it
 *  plays toward without looping still reports itself unpaused. */
function isAdvancing(handle: TimelineHandle): boolean {
  if (handle.isPaused() || handle.isCanceled()) return false;
  if (handle.timeScale() < 0) return handle.time() > 0;
  return loopsAgain(handle.loop()) || handle.time() < handle.duration();
}

/** A live handle read as `<Transport>`'s props, rendering each frame the playhead moves. */
export function useTimelinePlayback(handle: TimelineHandle): Omit<TransportProps, 'onSeek'> & { onSeek: (t: number) => void } {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // A resume, pause, seek, or edit made on the handle from elsewhere: the render
  // it asks for is what restarts the frame loop below.
  useEffect(() => handle.subscribePlayback(bump), [handle]);
  useEffect(() => handle.subscribe(bump), [handle]);

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
    playing: isAdvancing(handle),
    loop: handle.loop(),
    rate: Math.abs(handle.timeScale()),
    reverse: handle.timeScale() < 0,
    playhead: handle.time(),
    duration,
    onPlayingChange: (next) => {
      if (!next) {
        handle.pause();
        return;
      }
      // `rearm` declines to revive a timeline at the end it plays toward, so
      // resume alone would do nothing. Play-at-end rewinds first.
      if (handle.timeScale() < 0) {
        if (handle.time() <= 0) handle.seek(handle.duration());
      } else if (handle.time() >= handle.duration()) handle.seek(0);
      handle.resume();
      raf.request();
    },
    onLoopChange: (next) => { handle.setLoop(next); },
    onRateChange: (next) => { handle.setTimeScale(handle.timeScale() < 0 ? -next : next); },
    onReverseChange: (next) => { handle.setTimeScale((next ? -1 : 1) * Math.abs(handle.timeScale())); },
    onSeek: (t) => { handle.seek(t); },
  };
}
