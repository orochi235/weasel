import type { LabContextValue, RenderContext } from '@weasel-js/labkit';
import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import { type Channel, type Mismatch, openChannel } from '../protocol/channel';
import {
  type FaultPhase,
  type FromFrame,
  type Globals,
  PORT_HANDOFF,
  type PortHandoff,
  PROTOCOL_VERSION,
  stableStringify,
  type ToFrame,
} from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { isGlobalsPath, storyConfig } from './globals';
import { reportFrameScroll } from './loupe/frameScroll';
import { type Ready, readyKey } from './readyKey';
import { type A11yOutcome, type TrialFrames } from './trialFrames';
import { setRoute } from './useRoute';

const START_TIMEOUT_MS = 10_000;
/** Distinguishes one frame request from the next; only ever compared, never read. */
let requests = 0;

export interface Fault {
  phase: FaultPhase | null;
  message: string;
}

/** One handshake with one frame document; a reload replaces it. */
export interface Link {
  channel: Channel<FromFrame, ToFrame>;
  /** Takes each message to the view that holds the frame now. */
  deliver: (msg: FromFrame) => void;
  timer: ReturnType<typeof setTimeout>;
  /** The key of a `ready` whose `init` waits for an instrument built from it. */
  awaiting: string | null;
  /** What the frame holds, from `init` on — the story's config without the trial's pins; null until then. */
  sent: { config: unknown; state: unknown; globals: Globals } | null;
  /** `init`, `config`, `state` and `globals` messages sent; a render fault's `seq` counts the same messages. */
  inputs: number;
  /** Takes this link's channel out of the trial's frame registry. */
  disconnect: () => void;
  /** Audits waiting on an answer carrying the same id. */
  pending: Map<string, (outcome: A11yOutcome) => void>;
  /** Whether the frame has said it rendered; before that there is no story to audit. */
  hasRendered: boolean;
  /** Audits held until it has. */
  queued: (() => void)[];
}

export function closeLink(link: RefObject<Link | null>): void {
  if (!link.current) return;
  clearTimeout(link.current.timer);
  for (const settle of link.current.pending.values()) settle({ ok: false, message: 'The frame went away' });
  link.current.pending.clear();
  link.current.disconnect();
  link.current.channel.close();
  link.current = null;
}

export function mismatchMessage(mismatch: Mismatch): string {
  return mismatch.reason === 'version'
    ? `Frame speaks protocol ${String(mismatch.version)}; this workshop speaks ${PROTOCOL_VERSION}`
    : 'Frame sent a message that is not a forge envelope';
}

/** Sends the frame whichever of the trial's config, state and globals in `next` differ from what it holds; true when any did. */
export function sendInputs(current: Link, sent: NonNullable<Link['sent']>, next: NonNullable<Link['sent']>): boolean {
  const before = current.inputs;
  const { state, globals } = next;
  const config = storyConfig(next.config, sent.config);
  if (config !== sent.config) {
    sent.config = config;
    current.channel.send({ type: 'config', config });
    current.inputs += 1;
  }
  if (state !== sent.state) {
    sent.state = state;
    current.channel.send({ type: 'state', state });
    current.inputs += 1;
  }
  if (globals !== sent.globals && stableStringify(globals) !== stableStringify(sent.globals)) {
    sent.globals = globals;
    current.channel.send({ type: 'globals', globals });
    current.inputs += 1;
  }
  return current.inputs !== before;
}

/** What a link reads of its view as each message arrives: always the view's last commit. */
export interface FrameLinkLatest {
  entry: IndexEntry;
  ctx: RenderContext<unknown, unknown>;
  answers: AnswerBook;
  onReady: (entry: IndexEntry, ready: Ready) => void;
  descriptionKey: string | null;
  globals: Globals;
  overrides: Readonly<Record<string, string>>;
  lab: LabContextValue;
}

export interface FrameLinkOptions {
  latest: { readonly current: FrameLinkLatest };
  /** The frame's address, named in a fault when it never starts. */
  src: string;
  /** The trial whose frame registry entry, reports and swaps this link speaks for; null for none. */
  trialId: string | null;
  frames: TrialFrames | null;
  /** The view's host, which stands in for its frame's scroller in this document. */
  host: RefObject<HTMLElement | null>;
  setFault: Dispatch<SetStateAction<Fault | null>>;
  setPending: (pending: boolean) => void;
  /** A lens's copy of the trial's frame: it sends `init` on the first `ready`, and neither reports it nor records answers. */
  copy: boolean;
  /** The inputs sent to the frame whenever one changes. */
  config: unknown;
  state: unknown;
  globals: Globals;
  descriptionKey: string | null;
}

/** What `receive` and `openLink` read of the view: the hook's options at its last render, and its `init`. */
interface LinkDeps
  extends Pick<FrameLinkOptions, 'latest' | 'src' | 'trialId' | 'frames' | 'host' | 'setFault' | 'setPending' | 'copy'> {
  init: (current: Link) => void;
}

/** One message from the frame, taken as the view's last commit would. */
function receive(deps: LinkDeps, current: Link, msg: FromFrame): void {
  const { latest: latestRef, trialId, frames, host, setFault, setPending, init, copy } = deps;
  const { ctx: live, answers, onReady } = latestRef.current;
  switch (msg.type) {
    case 'ready': {
      clearTimeout(current.timer);
      setFault(null);
      for (const [name, value] of Object.entries(latestRef.current.overrides)) {
        current.channel.send({ type: 'vars.set', name, value });
      }
      // A copy renders a story its trial's instrument already describes.
      if (copy) {
        init(current);
        break;
      }
      const key = readyKey(msg);
      current.awaiting = key;
      onReady(latestRef.current.entry, msg);
      if (current.awaiting === key && key === latestRef.current.descriptionKey) init(current);
      break;
    }
    case 'rendered':
      setPending(false);
      current.hasRendered = true;
      for (const ask of current.queued.splice(0)) ask();
      break;
    case 'setConfig':
      // The pins belong to the trial; a story cannot see them, so it cannot set them either.
      if (!isGlobalsPath(msg.path)) live.setConfig(msg.path, msg.value);
      break;
    case 'setState':
      if (current.sent) current.sent.state = msg.state;
      live.setState(msg.state);
      break;
    case 'answers':
      if (!copy) answers.record(msg.answers);
      break;
    case 'vars':
      if (trialId) frames?.report(trialId, msg.vars);
      break;
    case 'a11y': {
      const outcome: A11yOutcome = msg.ok ? { ok: true, report: msg.report } : { ok: false, message: msg.message };
      if (trialId) frames?.reportA11y(trialId, outcome);
      current.pending.get(msg.id)?.(outcome);
      current.pending.delete(msg.id);
      break;
    }
    case 'scroll':
      // A copy follows its trial's scroll; where it stands itself is nothing anyone reads.
      if (!copy && host.current) reportFrameScroll(host.current, msg);
      break;
    case 'open': {
      const { lab: liveLab } = latestRef.current;
      if (!trialId || !liveLab.instruments.some((instrument) => instrument.name === msg.id)) break;
      liveLab.swapTrial(trialId, msg.id);
      setRoute(msg.id, { inPlace: true });
      break;
    }
    case 'fault':
      // A newer input is already on its way to the frame, which faults again if it still throws.
      if (msg.phase === 'render' && msg.seq !== undefined && msg.seq < current.inputs) break;
      clearTimeout(current.timer);
      setFault({ phase: msg.phase, message: msg.message });
      break;
  }
}

/** Hands `frame` a fresh port, closing the link before it, and holds the new link in `link`. */
function openLink(deps: LinkDeps, link: RefObject<Link | null>, frame: HTMLIFrameElement): void {
  const { latest: latestRef, src, trialId, frames, setFault, setPending } = deps;
  closeLink(link);
  setPending(true);
  const target = frame.contentWindow;
  if (!target) return;
  const { port1, port2 } = new MessageChannel();
  const timer = setTimeout(() => setFault({ phase: null, message: `Frame did not start: ${src}` }), START_TIMEOUT_MS);
  const channel = openChannel<FromFrame, ToFrame>(port1, {
    onMismatch: (mismatch) => {
      clearTimeout(timer);
      setFault({ phase: 'protocol', message: mismatchMessage(mismatch) });
    },
  });
  const waiting = new Map<string, (outcome: A11yOutcome) => void>();
  // Held until the frame says it rendered: before that there is no story to judge.
  const audit = (): Promise<A11yOutcome> =>
    new Promise((resolve) => {
      const id = `a11y-${(requests += 1)}`;
      waiting.set(id, resolve);
      const ask = () => channel.send({ type: 'a11y.run', id });
      if (current.hasRendered) ask();
      else current.queued.push(ask);
    });
  const disconnect = frames && trialId ? frames.connect(trialId, { send: channel.send, audit }) : () => {};
  const current: Link = {
    channel,
    deliver: (msg) => receive(deps, current, msg),
    timer,
    awaiting: null,
    sent: null,
    inputs: 0,
    disconnect,
    pending: waiting,
    hasRendered: false,
    queued: [],
  };
  link.current = current;
  channel.on((msg) => current.deliver(msg));
  target.postMessage({ type: PORT_HANDOFF, id: latestRef.current.entry.id } satisfies PortHandoff, location.origin, [
    port2,
  ]);
}

/**
 * The view's handshake with its frame: `connect` hands a loaded frame a port, `link` holds what came of it, and
 * `adopt` takes over the link of a frame handed on from the view before this one.
 */
export function useFrameLink(opts: FrameLinkOptions): {
  connect(frame: HTMLIFrameElement): void;
  adopt(adopted: Link): void;
  link: RefObject<Link | null>;
} {
  const { latest: latestRef, src, trialId, frames, host, setFault, setPending, copy, config, state, globals, descriptionKey } = opts;
  const link = useRef<Link | null>(null);

  const init = useCallback((current: Link): void => {
    const { ctx: live, globals: liveGlobals } = latestRef.current;
    current.awaiting = null;
    current.sent = { config: storyConfig(live.config), state: live.state, globals: liveGlobals };
    current.inputs += 1;
    current.channel.send({ type: 'init', ...current.sent });
  }, [latestRef]);

  const deps: LinkDeps = { latest: latestRef, src, trialId, frames, host, setFault, setPending, copy, init };
  const connect = (frame: HTMLIFrameElement): void => openLink(deps, link, frame);

  const adopt = (adopted: Link): void => {
    adopted.deliver = (msg) => receive(deps, adopted, msg);
    setPending(!adopted.hasRendered);
  };

  useEffect(() => {
    const current = link.current;
    if (!current) return;
    if (current.awaiting !== null) {
      if (current.awaiting === descriptionKey) init(current);
      return;
    }
    // The frame retries its render on new input and faults again if it still throws.
    if (current.sent && sendInputs(current, current.sent, { config, state, globals })) {
      setFault((shown) => (shown?.phase === 'render' ? null : shown));
    }
  }, [config, state, globals, descriptionKey, init, setFault]);

  return { connect, adopt, link };
}
