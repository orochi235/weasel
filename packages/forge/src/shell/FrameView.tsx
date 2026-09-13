import './shell.css';
import { type RenderContext, TrialIdContext } from '@weasel-js/labkit';
import { type RefObject, useContext, useEffect, useRef, useState } from 'react';
import { type Channel, type Mismatch, openChannel } from '../protocol/channel';
import {
  type FaultPhase,
  type FromFrame,
  type Globals,
  PORT_HANDOFF,
  PROTOCOL_VERSION,
  type ToFrame,
} from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { useCssOverrides } from './cssVars/overrides';
import { TrialFramesContext } from './cssVars/trialFrames';
import { type Ready, readyKey } from './readyKey';
import { StoryGlobalsContext } from './StoryGlobalsContext';

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
  /** What the frame holds, from `init` on; null until then. */
  sent: { config: unknown; state: unknown; globals: Globals } | null;
  /** `init`, `config`, `state` and `globals` messages sent; a render fault's `seq` counts the same messages. */
  inputs: number;
  /** Takes this link's channel out of the trial's frame registry. */
  disconnect: () => void;
}

function closeLink(link: RefObject<Link | null>): void {
  if (!link.current) return;
  clearTimeout(link.current.timer);
  link.current.disconnect();
  link.current.channel.close();
  link.current = null;
}

function mismatchMessage(mismatch: Mismatch): string {
  return mismatch.reason === 'version'
    ? `Frame speaks protocol ${String(mismatch.version)}; this workshop speaks ${PROTOCOL_VERSION}`
    : 'Frame sent a message that is not a forge envelope';
}

export function FrameView(props: FrameViewProps) {
  const { entry, frameUrl, descriptionKey, ctx } = props;
  const globals = useContext(StoryGlobalsContext);
  const trialId = useContext(TrialIdContext);
  const frames = useContext(TrialFramesContext);
  const [overrides] = useCssOverrides();
  const src = `${frameUrl}#${entry.id}`;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const link = useRef<Link | null>(null);
  const latest = useRef({ ...props, globals, overrides });
  latest.current = { ...props, globals, overrides };
  const [fault, setFault] = useState<Fault | null>(null);

  const init = (current: Link): void => {
    const { ctx: live, globals: liveGlobals } = latest.current;
    current.awaiting = null;
    current.sent = { config: live.config, state: live.state, globals: liveGlobals };
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
      case 'setConfig':
        live.setConfig(msg.path, msg.value);
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
      case 'fault':
        // A newer input is already on its way to the frame, which faults again if it still throws.
        if (msg.phase === 'render' && msg.seq !== undefined && msg.seq < current.inputs) break;
        clearTimeout(current.timer);
        setFault({ phase: msg.phase, message: msg.message });
        break;
    }
  };

  const onLoad = (): void => {
    closeLink(link);
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const { port1, port2 } = new MessageChannel();
    const timer = setTimeout(() => setFault({ phase: null, message: `Frame did not start: ${src}` }), START_TIMEOUT_MS);
    const channel = openChannel<FromFrame, ToFrame>(port1, {
      onMismatch: (mismatch) => {
        clearTimeout(timer);
        setFault({ phase: 'protocol', message: mismatchMessage(mismatch) });
      },
    });
    const disconnect = frames && trialId ? frames.connect(trialId, channel.send) : () => {};
    const current: Link = { channel, timer, awaiting: null, sent: null, inputs: 0, disconnect };
    link.current = current;
    channel.on((msg) => receive(current, msg));
    target.postMessage({ type: PORT_HANDOFF }, location.origin, [port2]);
  };

  useEffect(() => () => closeLink(link), []);

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
    if (ctx.config !== sent.config) {
      sent.config = ctx.config;
      current.channel.send({ type: 'config', config: ctx.config });
      current.inputs += 1;
      input = true;
    }
    if (ctx.state !== sent.state) {
      sent.state = ctx.state;
      current.channel.send({ type: 'state', state: ctx.state });
      current.inputs += 1;
      input = true;
    }
    if (globals !== sent.globals) {
      sent.globals = globals;
      current.channel.send({ type: 'globals', globals });
      current.inputs += 1;
      input = true;
    }
    // The frame retries its render on new input and faults again if it still throws.
    if (input) setFault((shown) => (shown?.phase === 'render' ? null : shown));
  }, [ctx.config, ctx.state, globals, descriptionKey]);

  return (
    <div className="fg-frame-host">
      <iframe
        ref={iframeRef}
        className="fg-frame-view"
        src={src}
        title={`${entry.title} / ${entry.name}`}
        onLoad={onLoad}
      />
      {fault ? (
        <div className="fg-fault" role="alert">
          {fault.phase ? <span className="fg-fault__phase">{fault.phase}</span> : null}
          <p className="fg-fault__message">{fault.message}</p>
        </div>
      ) : null}
    </div>
  );
}
