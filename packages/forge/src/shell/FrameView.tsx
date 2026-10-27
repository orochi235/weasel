import { breadcrumb } from './breadcrumb';
import './shell.css';
import { useLatest } from '@weasel-js/core';
import { type RenderContext, TrialIdContext, useLabContext } from '@weasel-js/labkit';
import { type Dispatch, type RefObject, type SetStateAction, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import { useNearViewport } from '@weasel-js/react';
import { IN_VIEW_MARGIN } from './inViewMargin';
import { FRAME_HELLO } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { useCssOverrides } from './cssVars/overrides';
import { closeLink, type Fault, type Link, useFrameLink } from './frameLink';
import { FramePoolContext, HELLO_TIMEOUT_MS, moveFrame } from './framePool';
import { effectiveGlobals, GLOBALS_KEY } from './globals';
import { applyGlobalsTo } from './hostConditions';
import { useKeptFrame } from './keptFrame';
import { scrollOf } from './loupe/frameScroll';
import { type LensFrameCopy, LiveFrameCopies, useCopyConfig } from './loupe/LiveCopies';
import type { Ready } from './readyKey';
import { TrialFramesContext } from './trialFrames';
import { StoryGlobalsContext } from './StoryGlobalsContext';

export interface FrameViewProps {
  entry: IndexEntry;
  frameUrl: string;
  answers: AnswerBook;
  onReady: (entry: IndexEntry, ready: Ready) => void;
  /** `readyKey` of the ready this view's instrument was built from; null while the instrument is provisional. */
  descriptionKey: string | null;
  ctx: RenderContext<unknown, unknown>;
  /**
   * Makes this view a lens's second copy of the trial's story, in a frame of its own: it takes `id` as its host id,
   * renders under `globals` with `args` laid over the trial's config, scrolls wherever `main` says the trial's frame
   * stands, and stays out of the frame pool, the kept frames, the frame registry and the answer book. It reports no
   * `ready` and swaps no trial.
   */
  copy?: LensFrameCopy;
  /** The workshop's frame setup. A copy's host takes its globals through it, so what it paints behind the copy's
   *  frame is in the copy's mode rather than the lab's. */
  setup?: FrameSetup;
}

interface FrameMount {
  inView: boolean;
  src: string;
  slotRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  latest: { readonly current: { pool: { claim(): HTMLIFrameElement | null } | null; title: string; copy?: FrameViewProps['copy'] } };
  connect: { readonly current: (frame: HTMLIFrameElement) => void };
  link: RefObject<Link | null>;
  handedOn: () => boolean;
  setFault: Dispatch<SetStateAction<Fault | null>>;
  setPending: (pending: boolean) => void;
}

/**
 * Puts the view's frame in its slot while it is in view: the one it adopted, a warm one from the pool, or a new one.
 * A trial out of view drops its frame, and with it any WebGL contexts the story held; the config and state live in
 * the trial, so a return brings up a new frame and `init` carries them back.
 */
function mountFrame(m: FrameMount): (() => void) | undefined {
  const { inView, src, slotRef, iframeRef, latest: latestRef, connect: connectRef, link, handedOn, setFault, setPending } = m;
  const slot = slotRef.current;
  if (!inView || !slot) return undefined;
  // Already in the slot, loaded and linked, when it came from the view this one replaced.
  const adopted = iframeRef.current;
  const claimed = adopted || latestRef.current.copy ? null : (latestRef.current.pool?.claim() ?? null);
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
}

const NO_ARGS: Readonly<Record<string, unknown>> = {};

export function FrameView(props: FrameViewProps) {
  const { entry, frameUrl, answers, descriptionKey, ctx: trialCtx, copy } = props;
  const labGlobals = useContext(StoryGlobalsContext);
  const pins = (trialCtx.config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const own = useMemo(() => effectiveGlobals(labGlobals, pins), [labGlobals, pins]);
  const globals = copy ? copy.globals : own;
  const { config: laidConfig, setConfig: laidSetConfig } = useCopyConfig(trialCtx.config, trialCtx.setConfig, copy?.args ?? NO_ARGS);
  const ctx = useMemo(
    () => (copy ? { ...trialCtx, config: laidConfig, setConfig: laidSetConfig } : trialCtx),
    [copy, trialCtx, laidConfig, laidSetConfig],
  );
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
  const latestRef = useLatest({ ...props, ctx, globals, overrides, pool, lab, title });
  const [fault, setFault] = useState<Fault | null>(null);
  // A loaded document stays hidden until its story has rendered, so a new trial never shows the blank page.
  const [pending, setPending] = useState(true);

  const { connect, adopt, link } = useFrameLink({
    latest: latestRef,
    src,
    trialId: copy ? null : trialId,
    frames: copy ? null : frames,
    host: hostRef,
    setFault,
    setPending,
    copy: copy !== undefined,
    config: ctx.config,
    state: ctx.state,
    globals,
    descriptionKey,
  });

  const connectRef = useLatest(connect);

  const handedOn = useKeptFrame<Link>({
    key: trialId && !copy ? `${trialId} ${src}` : null,
    slot: slotRef,
    frame: iframeRef,
    link,
    onAdopt: adopt,
    onDrop: () => closeLink(link),
  });

  useEffect(
    () => mountFrame({ inView, src, slotRef, iframeRef, latest: latestRef, connect: connectRef, link, handedOn, setFault, setPending }),
    [inView, src, connectRef, latestRef, handedOn, link],
  );

  useEffect(() => {
    iframeRef.current?.toggleAttribute('data-pending', pending && !fault);
  }, [pending, fault, inView, src]);

  useEffect(() => {
    if (iframeRef.current) iframeRef.current.title = title;
  }, [title]);

  useEffect(() => (copy ? undefined : answers.hold(ctx.config)), [answers, ctx.config, copy]);

  const setup = props.setup;
  const copyId = copy?.id;
  useLayoutEffect(
    () => (copyId && setup && hostRef.current ? applyGlobalsTo(hostRef.current, copyId, globals, setup) : undefined),
    [copyId, globals, setup],
  );

  // No observer in the frame sees the lens's transform, which is outside its document, so a canvas there measures the
  // scale it is shown at again only on a resize.
  const factor = copy?.factor;
  useEffect(() => {
    if (factor !== undefined) iframeRef.current?.contentWindow?.dispatchEvent(new Event('resize'));
  }, [factor]);

  // Applied once the copy has rendered, when its document is tall enough to stand where the trial's does.
  const main = copy?.main;
  useEffect(() => {
    if (!main || pending) return undefined;
    const follow = () => link.current?.channel.send({ type: 'scroll', ...scrollOf(main) });
    follow();
    main.addEventListener('scroll', follow, { passive: true });
    return () => main.removeEventListener('scroll', follow);
  }, [main, pending, link]);

  return (
    <div ref={hostRef} className="fg-frame-host" data-fg-host={copy?.id ?? trialId ?? undefined} data-fg-copy={copy ? '' : undefined}>
      {/* The frame is placed here by hand: a pooled one arrives already loaded, and React would reload it. */}
      <div ref={slotRef} className="fg-frame-slot" />
      {fault ? (
        <div className="fg-fault" role="alert">
          {fault.phase ? <span className="fg-fault__phase">{fault.phase}</span> : null}
          <p className="fg-fault__message">{fault.message}</p>
        </div>
      ) : null}
      {copy ? null : (
        <LiveFrameCopies trialId={trialId} trialConfig={trialCtx.config}>
          {(lensCopy) => <FrameView {...props} copy={lensCopy} />}
        </LiveFrameCopies>
      )}
    </div>
  );
}
