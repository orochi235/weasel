import type { ClockRegistry } from '@weasel-js/clock';
import { useEffect, useSyncExternalStore } from 'react';
import { transportControl } from '../clock/transportControl';
import { transportHoldOf } from '../clock/transportHold';
import type { TrialClockHandle } from '../clock/trialClock';

/**
 * What a host page posts to a presented lab's window to work its clock:
 * `iframe.contentWindow.postMessage({ type: 'labkit:play' }, origin)` for a
 * lab in a frame, `window.postMessage` for one in the page itself. `lab`
 * addresses the one lab of that name; without it, every lab in the window
 * answers.
 */
export type PresentationCommand =
  /** As the play button: an ended run starts over. */
  | { type: 'labkit:play'; lab?: string }
  | { type: 'labkit:pause'; lab?: string }
  /** Move to shown `time` ms (the clock's `origin` plus the time within the pass), on a clock that is `seekable`. */
  | { type: 'labkit:seek'; time: number; lab?: string }
  /** Ask for a `labkit:state`. */
  | { type: 'labkit:query'; lab?: string };

/** What a presented lab posts to the window around it — its own, when it is
 *  in no frame — as it starts presenting, on every play, pause, seek, speed,
 *  loop and end, and when asked. Never per frame. */
export interface PresentationState {
  type: 'labkit:state';
  /** The lab's `messages.name`, when it has one. */
  lab?: string;
  /** Whether the presented trial has a clock. Without one the rest are at rest. */
  clock: boolean;
  playing: boolean;
  ended: boolean;
  /** ms into the current pass; for a run with no end, ms played. */
  time: number;
  /** ms per pass; `null` for a run with no end. */
  duration: number | null;
  /** The speed it plays at, or will once played; negative backward. */
  rate: number;
  /** Whether `labkit:seek` moves it. */
  seekable: boolean;
}

/** How a presented lab answers its host page's messages. */
export interface PresentationMessageOptions {
  /** Names this lab, for a page that holds several: a message whose `lab` is
   *  another name is ignored, and every `labkit:state` carries this one. */
  name?: string;
  /** The origins a message is taken from. Default: any. */
  origins?: readonly string[];
}

const TYPES = new Set(['labkit:play', 'labkit:pause', 'labkit:seek', 'labkit:query']);

/** `data` as a command for the lab named `name`, or `null` when it is not one. */
export function presentationCommand(
  data: unknown,
  name: string | undefined,
): PresentationCommand | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, lab, time } = data as Record<string, unknown>;
  if (typeof type !== 'string' || !TYPES.has(type)) return null;
  if (lab !== undefined && lab !== name) return null;
  if (type === 'labkit:seek' && !(typeof time === 'number' && Number.isFinite(time))) return null;
  return data as PresentationCommand;
}

/** Where the clock behind `handle` stands, as a host page is told. */
export function presentationState(
  handle: TrialClockHandle | null,
  name: string | undefined,
): PresentationState {
  const named = name === undefined ? {} : { lab: name };
  if (!handle)
    return {
      type: 'labkit:state',
      ...named,
      clock: false,
      playing: false,
      ended: false,
      time: 0,
      duration: null,
      rate: 0,
      seekable: false,
    };
  const { clock } = handle;
  const hold = transportHoldOf(clock);
  const control = transportControl(clock, hold.get(), hold.set);
  return {
    type: 'labkit:state',
    ...named,
    clock: true,
    playing: control.playing,
    ended: clock.ended,
    time: control.playhead,
    duration: Number.isFinite(clock.duration) ? clock.duration : null,
    rate: control.backward ? -control.speed : control.speed,
    seekable: control.scrubs,
  };
}

function run(command: PresentationCommand, handle: TrialClockHandle): void {
  const hold = transportHoldOf(handle.clock);
  hold.touch();
  const control = transportControl(handle.clock, hold.get(), hold.set);
  if (command.type === 'labkit:play') control.play();
  else if (command.type === 'labkit:pause') control.pause();
  else if (command.type === 'labkit:seek') control.seek(command.time);
}

/**
 * While `active`, work trial `trialId`'s clock from the messages the host page
 * posts to `view`, and post that clock's state to the window around `view`.
 * A trial whose instrument declares a clock (`clocked`) is neither listened to
 * nor announced until that clock is registered, so the first state a host
 * reads is true and a command it sends on reading it reaches the clock.
 */
export function usePresentationMessages(
  active: boolean,
  view: Window | null,
  clocks: ClockRegistry,
  trialId: string | null,
  clocked: boolean,
  { name, origins }: PresentationMessageOptions,
): void {
  const handle = useSyncExternalStore(clocks.subscribe, () =>
    trialId === null ? null : clocks.get(trialId),
  );
  const allowed = origins?.join(' ');
  useEffect(() => {
    if (!active || !view || (clocked && !handle)) return;
    const host = view.parent;
    const post = (): void => host.postMessage(presentationState(handle, name), '*');
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== host && event.source !== view) return;
      if (allowed !== undefined && !allowed.split(' ').includes(event.origin)) return;
      const command = presentationCommand(event.data, name);
      if (!command) return;
      if (command.type === 'labkit:query') post();
      else if (handle) run(command, handle);
    };
    view.addEventListener('message', onMessage);
    const offClock = handle?.clock.subscribe(post);
    const offHold = handle ? transportHoldOf(handle.clock).subscribe(post) : undefined;
    post();
    return () => {
      view.removeEventListener('message', onMessage);
      offClock?.();
      offHold?.();
    };
  }, [active, view, handle, clocked, name, allowed]);
}
