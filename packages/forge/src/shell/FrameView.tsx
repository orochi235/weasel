import { breadcrumb } from './breadcrumb';
import './shell.css';
import { type RenderContext, TrialIdContext, useLabContext } from '@weasel-js/labkit';
import { type RefObject, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  type CapturedPicture,
  type ToFrame,
} from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { useCssOverrides } from './cssVars/overrides';
import { FramePoolContext, moveFrame } from './framePool';

import { effectiveGlobals, GLOBALS_KEY, isGlobalsPath, storyConfig } from './globals';
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
/** Longer than a cold dev server takes to serve a frame document its first time. */
const HELLO_TIMEOUT_MS = 30_000;
/** Distinguishes one frame request from the next; only ever compared, never read. */
let requests = 0;
/** How far past the viewport a frame stays mounted, so a small scroll back does not reload it. */
const IN_VIEW_MARGIN = '50%';

/** Whether `ref`'s element is near the viewport; true where the browser cannot say. */
function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1);
        if (last) setInView(last.isIntersecting);
      },
      { rootMargin: IN_VIEW_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

interface Settle {
  resolve: (value: never) => void;
  fail: (error: Error) => void;
  /** How this request ends when the frame goes away before answering. */
  gone: () => void;
}

interface Fault {
  phase: FaultPhase | null;
  message: string;
}

/** One handshake with one frame document; a reload replaces it. */
interface Link {
  channel: Channel<FromFrame, ToFrame>;
  timer: ReturnType<typeof setTimeout>;
  /** The key of a `ready` whose `init` waits for an instrument built from it. */
  awaiting: string | null;
  /** What the frame holds, from `init` on — the story's config without the trial's pins; null until then. */
  sent: { config: unknown; state: unknown; globals: Globals } | null;
  /** `init`, `config`, `state` and `globals` messages sent; a render fault's `seq` counts the same messages. */
  inputs: number;
  /** Takes this link's channel out of the trial's frame registry. */
  disconnect: () => void;
  /** Requests waiting on an answer carrying the same id. */
  pending: Map<string, Settle>;
  /** Whether the frame has said it rendered; before that there is no story to ask anything about. */
  hasRendered: boolean;
  /** Requests held until it has. */
  queued: (() => void)[];
}

function closeLink(link: RefObject<Link | null>): void {
  if (!link.current) return;
  clearTimeout(link.current.timer);
  for (const settle of link.current.pending.values()) settle.gone();
  link.current.pending.clear();
  link.current.disconnect();
  link.current.channel.close();
  link.current = null;
}

function settle(link: Link, id: string, value: unknown): void {
  (link.pending.get(id)?.resolve as ((v: unknown) => void) | undefined)?.(value);
  link.pending.delete(id);
}

function mismatchMessage(mismatch: Mismatch): string {
  return mismatch.reason === 'version'
    ? `Frame speaks protocol ${String(mismatch.version)}; this workshop speaks ${PROTOCOL_VERSION}`
    : 'Frame sent a message that is not a forge envelope';
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
  const inView = useInView(hostRef);
  const link = useRef<Link | null>(null);
  const latest = useRef({ ...props, globals, overrides, pool, lab });
  latest.current = { ...props, globals, overrides, pool, lab };
  const [fault, setFault] = useState<Fault | null>(null);
  // A loaded document stays hidden until its story has rendered, so a new trial never shows the blank page.
  const [pending, setPending] = useState(true);

  const init = (current: Link): void => {
    const { ctx: live, globals: liveGlobals } = latest.current;
    current.awaiting = null;
    current.sent = { config: storyConfig(live.config), state: live.state, globals: liveGlobals };
    current.inputs += 1;
    current.channel.send({ type: 'init', ...current.sent });
  };

  const receive = (current: Link, msg: FromFrame): void => {
    const { ctx: live, answers, onReady } = latest.current;
    switch (msg.type) {
      case 'ready': {
        clearTimeout(current.timer);
        setFault(null);
        for (const [name, value] of Object.entries(latest.current.overrides)) {
          current.channel.send({ type: 'vars.set', name, value });
        }
        const key = readyKey(msg);
        current.awaiting = key;
        onReady(latest.current.entry, msg);
        if (current.awaiting === key && key === latest.current.descriptionKey) init(current);
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
      case 'size':
        if (trialId) frames?.reportSize(trialId, { width: msg.width, height: msg.height });
        break;
      case 'a11y': {
        const outcome: A11yOutcome = msg.ok ? { ok: true, report: msg.report } : { ok: false, message: msg.message };
        if (trialId) frames?.reportA11y(trialId, outcome);
        settle(current, msg.id, outcome);
        break;
      }
      case 'capture':
        if (msg.ok) settle(current, msg.id, msg.picture);
        else current.pending.get(msg.id)?.fail(new Error(msg.message));
        current.pending.delete(msg.id);
        break;
      case 'open': {
        const { lab: liveLab } = latest.current;
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
    const waiting = new Map<string, Settle>();
    // Held until the frame says it rendered: before that there is no story to judge or to draw.
    const request = <T,>(id: string, msg: ToFrame, gone: (settle: Settle['resolve'], fail: (e: Error) => void) => void) =>
      new Promise<T>((resolve, reject) => {
        waiting.set(id, {
          resolve: resolve as Settle['resolve'],
          fail: reject,
          gone: () => gone(resolve as Settle['resolve'], reject),
        });
        const ask = () => channel.send(msg);
        if (current.hasRendered) ask();
        else current.queued.push(ask);
      });
    // An audit's failure is an outcome the panel shows; a capture's is a rejection, because labkit's
    // `base()` has nowhere to put one.
    const audit = (): Promise<A11yOutcome> => {
      const id = `a11y-${(requests += 1)}`;
      return request<A11yOutcome>(id, { type: 'a11y.run', id }, (resolve) =>
        resolve({ ok: false, message: 'The frame went away' } as never),
      );
    };
    const capture = (): Promise<CapturedPicture> => {
      const id = `capture-${(requests += 1)}`;
      return request<CapturedPicture>(id, { type: 'capture.run', id }, (_resolve, fail) =>
        fail(new Error('The frame could not draw itself')),
      );
    };
    const disconnect =
      frames && trialId ? frames.connect(trialId, { send: channel.send, audit, capture }) : () => {};
    const current: Link = {
      channel,
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
    channel.on((msg) => receive(current, msg));
    target.postMessage({ type: PORT_HANDOFF, id: latest.current.entry.id } satisfies PortHandoff, location.origin, [
      port2,
    ]);
  };

  // A trial out of view drops its frame, and with it any WebGL contexts the story held; the config and state
  // live in the trial, so a return brings up a new frame and `init` carries them back.
  useEffect(() => {
    const slot = slotRef.current;
    if (!inView || !slot) return;
    const claimed = latest.current.pool?.claim() ?? null;
    const frame = claimed ?? document.createElement('iframe');
    frame.className = 'fg-frame-view';
    frame.title = title;
    frame.removeAttribute('tabindex');
    frame.toggleAttribute('data-pending', true);
    iframeRef.current = frame;
    // Handshakes start on the document's hello, never on `load`: that fires before the hello, and a port handed
    // over then is one the frame, which keeps only its first, would still take in place of the right one.
    const unheard = claimed
      ? undefined
      : setTimeout(() => setFault({ phase: null, message: `Frame did not start: ${src}` }), HELLO_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      if ((event.data as { type?: unknown } | null)?.type !== FRAME_HELLO) return;
      clearTimeout(unheard);
      connect(frame);
    };
    window.addEventListener('message', onMessage);
    if (claimed) {
      moveFrame(slot, claimed);
      connect(claimed);
    } else {
      frame.src = src;
      slot.append(frame);
    }
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(unheard);
      closeLink(link);
      frame.remove();
      iframeRef.current = null;
      setPending(true);
      setFault(null);
    };
  }, [inView, src]);

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
    const sent = current.sent;
    if (!sent) return;
    let input = false;
    const config = storyConfig(ctx.config, sent.config);
    if (config !== sent.config) {
      sent.config = config;
      current.channel.send({ type: 'config', config });
      current.inputs += 1;
      input = true;
    }
    if (ctx.state !== sent.state) {
      sent.state = ctx.state;
      current.channel.send({ type: 'state', state: ctx.state });
      current.inputs += 1;
      input = true;
    }
    if (globals !== sent.globals && stableStringify(globals) !== stableStringify(sent.globals)) {
      sent.globals = globals;
      current.channel.send({ type: 'globals', globals });
      current.inputs += 1;
      input = true;
    }
    // The frame retries its render on new input and faults again if it still throws.
    if (input) setFault((shown) => (shown?.phase === 'render' ? null : shown));
  }, [ctx.config, ctx.state, globals, descriptionKey]);

  return (
    <div
      ref={(el) => {
        hostRef.current = el;
        if (trialId && frames) frames.hostRef(trialId).current = el;
      }}
      className="fg-frame-host"
    >
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
