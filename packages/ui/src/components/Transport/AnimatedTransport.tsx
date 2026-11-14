import type { ReactElement } from 'react';
import type { TimelineHandle } from '@weasel-js/animator';
import { Transport, type TransportProps } from './Transport';
import { useTimelinePlayback } from './useTimelinePlayback';

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
