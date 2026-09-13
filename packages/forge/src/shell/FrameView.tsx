import './shell.css';
import type { RenderContext } from '@weasel-js/labkit';
import { type RefObject, useEffect, useRef, useState } from 'react';
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

export interface FrameViewProps {
  entry: IndexEntry;
  frameUrl: string;
  answers: AnswerBook;
  onReady: (entry: IndexEntry, ready: Extract<FromFrame, { type: 'ready' }>) => void;
  globals: Globals;
  ctx: RenderContext<unknown, unknown>;
}

const START_TIMEOUT_MS = 10_000;
const NOTHING = Symbol('nothing');

interface Fault {
  phase: FaultPhase | null;
  message: string;
}

/** One handshake with one frame document; a reload replaces it. */
interface Link {
  channel: Channel<FromFrame, ToFrame>;
  timer: ReturnType<typeof setTimeout>;
  /** What the frame holds, from `init` on; null until its `ready`. */
  sent: { config: unknown; state: unknown; globals: Globals } | null;
  /** The last state the frame sent, which must not be sent back to it. */
  fromFrame: unknown;
}

function closeLink(link: RefObject<Link | null>): void {
  if (!link.current) return;
  clearTimeout(link.current.timer);
  link.current.channel.close();
  link.current = null;
}

function mismatchMessage(mismatch: Mismatch): string {
  return mismatch.reason === 'version'
    ? `Frame speaks protocol ${String(mismatch.version)}; this workshop speaks ${PROTOCOL_VERSION}`
    : 'Frame sent a message that is not a forge envelope';
}

export function FrameView(props: FrameViewProps) {
  const { entry, frameUrl, globals, ctx } = props;
  const src = `${frameUrl}#${entry.id}`;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const link = useRef<Link | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [fault, setFault] = useState<Fault | null>(null);

  const receive = (current: Link, msg: FromFrame): void => {
    const { ctx: live, answers, onReady, globals: liveGlobals } = latest.current;
    switch (msg.type) {
      case 'ready':
        clearTimeout(current.timer);
        setFault(null);
        onReady(latest.current.entry, msg);
        current.sent = { config: live.config, state: live.state, globals: liveGlobals };
        current.channel.send({ type: 'init', ...current.sent });
        break;
      case 'setConfig':
        live.setConfig(msg.path, msg.value);
        break;
      case 'setState':
        current.fromFrame = msg.state;
        live.setState(msg.state);
        break;
      case 'answers':
        answers.record(msg.answers);
        break;
      case 'fault':
        setFault({ phase: msg.phase, message: msg.message });
        break;
    }
  };

  const onLoad = (): void => {
    closeLink(link);
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const { port1, port2 } = new MessageChannel();
    const channel = openChannel<FromFrame, ToFrame>(port1, {
      onMismatch: (mismatch) => setFault({ phase: 'protocol', message: mismatchMessage(mismatch) }),
    });
    const current: Link = {
      channel,
      timer: setTimeout(() => setFault({ phase: null, message: `Frame did not start: ${src}` }), START_TIMEOUT_MS),
      sent: null,
      fromFrame: NOTHING,
    };
    link.current = current;
    channel.on((msg) => receive(current, msg));
    target.postMessage({ type: PORT_HANDOFF }, location.origin, [port2]);
  };

  useEffect(() => () => closeLink(link), []);

  useEffect(() => {
    const current = link.current;
    const sent = current?.sent;
    if (!current || !sent) return;
    if (ctx.config !== sent.config) {
      sent.config = ctx.config;
      current.channel.send({ type: 'config', config: ctx.config });
    }
    if (ctx.state !== sent.state) {
      sent.state = ctx.state;
      if (ctx.state !== current.fromFrame) current.channel.send({ type: 'state', state: ctx.state });
    }
    if (globals !== sent.globals) {
      sent.globals = globals;
      current.channel.send({ type: 'globals', globals });
    }
  }, [ctx.config, ctx.state, globals]);

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
