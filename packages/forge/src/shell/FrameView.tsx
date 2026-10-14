import { breadcrumb } from './breadcrumb';
import './shell.css';
import { useLatest } from '@weasel-js/core';
import { type RenderContext, TrialIdContext, useLabContext } from '@weasel-js/labkit';
import { type RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IN_VIEW_MARGIN, useNearViewport } from '../frame/useNearViewport';
import { type Channel, type Mismatch, openChannel } from '../protocol/channel';
import {
  type FaultPhase,
  FRAME_HELLO,
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
import { useCssOverrides } from './cssVars/overrides';
import { FramePoolContext, HELLO_TIMEOUT_MS, moveFrame } from './framePool';

import { effectiveGlobals, GLOBALS_KEY, isGlobalsPath, storyConfig } from './globals';
import { useKeptFrame } from './keptFrame';
import { type Ready, readyKey } from './readyKey';
import { type A11yOutcome, TrialFramesContext } from './trialFrames';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { setRoute } from './useRoute';

export interface FrameViewProps {
  entry: IndexEntry;
  frameUrl: string;
  answers: AnswerBook;
  onReady: (entry: IndexEntry, ready: Ready) => void;
  /** `readyKey` of the ready this view's instrument was built from; null while the instrument is provisional. */
  descriptionKey: string | null;
  ctx: RenderContext<unknown, unknown>;
}

const START_TIMEOUT_MS = 10_000;
/** Distinguishes one frame request from the next; only ever compared, never read. */
let requests = 0;

interface Fault {
  phase: FaultPhase | null;
  message: string;
}

/** One handshake with one frame document; a reload replaces it. */
interface Link {
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

function closeLink(link: RefObject<Link | null>): void {
  if (!link.current) return;
  clearTimeout(link.current.timer);
  for (const settle of link.current.pending.values()) settle({ ok: false, message: 'The frame went away' });
  link.current.pending.clear();
  link.current.disconnect();
  link.current.channel.close();
  link.current = null;
}

function mismatchMessage(mismatch: Mismatch): string {
  return mismatch.reason === 'version'
    ? `Frame speaks protocol ${String(mismatch.version)}; this workshop speaks ${PROTOCOL_VERSION}`
    : 'Frame sent a message that is not a forge envelope';
}

/** Sends the frame whichever of the trial's config, state and globals in `next` differ from what it holds; true when any did. */
function sendInputs(current: Link, sent: NonNullable<Link['sent']>, next: NonNullable<Link['sent']>): boolean {
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

export function FrameView(props: FrameViewProps) {
  const { entry, frameUrl, answers, descriptionKey, ctx } = props;
  const labGlobals = useContext(StoryGlobalsContext);
  const pins = (ctx.config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const globals = useMemo(() => effectiveGlobals(labGlobals, pins), [labGlobals, pins]);
  const trialId = useContext(TrialIdContext);
  const frames = useContext(TrialFramesContext);
  const [overrides] = useCssOverrides();
  const pool = useContext(FramePoolContext);
  const lab = useLabContext();
  const src = `${frameUrl}#${entry.id}`;
  const title = breadcrumb(entry.title, entry.name);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const inView = useNearViewport(hostRef, IN_VIEW_MARGIN);
  const link = useRef<Link | null>(null);
  const latestRef = useLatest({ ...props, globals, overrides, pool, lab, title });
  const [fault, setFault] = useState<Fault | null>(null);
  // A loaded document stays hidden until its story has rendered, so a new trial never shows the blank page.
  const [pending, setPending] = useState(true);

  const init = useCallback((current: Link): void => {
    const { ctx: live, globals: liveGlobals } = latestRef.current;
    current.awaiting = null;
    current.sent = { config: storyConfig(live.config), state: live.state, globals: liveGlobals };
    current.inputs += 1;
    current.channel.send({ type: 'init', ...current.sent });
  }, [latestRef]);

  const receive = (current: Link, msg: FromFrame): void => {
    const { ctx: live, answers, onReady } = latestRef.current;
    switch (msg.type) {
      case 'ready': {
        clearTimeout(current.timer);
        setFault(null);
        for (const [name, value] of Object.entries(latestRef.current.overrides)) {
          current.channel.send({ type: 'vars.set', name, value });
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
        answers.record(msg.answers);
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
  };

  const connect = (frame: HTMLIFrameElement): void => {
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
      deliver: (msg) => receive(current, msg),
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
  };

  const connectRef = useLatest(connect);

  const handedOn = useKeptFrame<Link>({
    key: trialId ? `${trialId} ${src}` : null,
    slot: slotRef,
    frame: iframeRef,
    link,
    onAdopt: (adopted) => {
      adopted.deliver = (msg) => receive(adopted, msg);
      setPending(!adopted.hasRendered);
    },
    onDrop: () => closeLink(link),
  });

  // A trial out of view drops its frame, and with it any WebGL contexts the story held; the config and state
  // live in the trial, so a return brings up a new frame and `init` carries them back.
  useEffect(() => {
    const slot = slotRef.current;
    if (!inView || !slot) return;
    // Already in the slot, loaded and linked, when it came from the view this one replaced.
    const adopted = iframeRef.current;
    const claimed = adopted ? null : (latestRef.current.pool?.claim() ?? null);
    const frame = adopted ?? claimed ?? document.createElement('iframe');
    frame.className = 'fg-frame-view';
    frame.title = latestRef.current.title;
    frame.removeAttribute('tabindex');
    frame.toggleAttribute('data-pending', true);
    iframeRef.current = frame;
    // Handshakes start on the document's hello, never on `load`: that fires before the hello, and a port handed
    // over then is one the frame, which keeps only its first, would still take in place of the right one.
    const unheard = adopted || claimed
      ? undefined
      : setTimeout(() => setFault({ phase: null, message: `Frame did not start: ${src}` }), HELLO_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      if ((event.data as { type?: unknown } | null)?.type !== FRAME_HELLO) return;
      clearTimeout(unheard);
      connectRef.current(frame);
    };
    window.addEventListener('message', onMessage);
    if (claimed) {
      moveFrame(slot, claimed);
      connectRef.current(claimed);
    } else if (!adopted) {
      frame.src = src;
      slot.append(frame);
    }
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(unheard);
      if (handedOn()) return;
      closeLink(link);
      frame.remove();
      iframeRef.current = null;
      setPending(true);
      setFault(null);
    };
  }, [inView, src, connectRef, latestRef, handedOn]);

  useEffect(() => {
    iframeRef.current?.toggleAttribute('data-pending', pending && !fault);
  }, [pending, fault, inView, src]);

  useEffect(() => {
    if (iframeRef.current) iframeRef.current.title = title;
  }, [title]);

  useEffect(() => answers.hold(ctx.config), [answers, ctx.config]);

  useEffect(() => {
    const current = link.current;
    if (!current) return;
    if (current.awaiting !== null) {
      if (current.awaiting === descriptionKey) init(current);
      return;
    }
    // The frame retries its render on new input and faults again if it still throws.
    if (current.sent && sendInputs(current, current.sent, { config: ctx.config, state: ctx.state, globals })) {
      setFault((shown) => (shown?.phase === 'render' ? null : shown));
    }
  }, [ctx.config, ctx.state, globals, descriptionKey, init]);

  return (
    <div ref={hostRef} className="fg-frame-host">
      {/* The frame is placed here by hand: a pooled one arrives already loaded, and React would reload it. */}
      <div ref={slotRef} className="fg-frame-slot" />
      {fault ? (
        <div className="fg-fault" role="alert">
          {fault.phase ? <span className="fg-fault__phase">{fault.phase}</span> : null}
          <p className="fg-fault__message">{fault.message}</p>
        </div>
      ) : null}
    </div>
  );
}
