import './loupe.css';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import type { FrameSetup } from '../../frame/FrameController';
import type { Globals, Layout } from '../../protocol/messages';
import type { ClockHandle } from '@weasel-js/clock';
import { StoryClockProvider } from '../../timeline/StoryClock';
import type { TimelineSpec } from '../../timeline/types';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryBody, type StoryBodyProps } from '../StoryBody';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { TrialHost } from '../TrialHost';
import { resolveComparison, withArgs } from './conditions';
import { type LiveLenses, LiveLensesContext, type LiveRequest } from './liveLenses';
import { scrollerOf } from './trialAt';

/** Props for `LiveCopies`: what a trial renders its own content with, which every copy of it shares. */
export interface LiveCopiesProps {
  trialId: string | null;
  layout: Layout;
  setup: FrameSetup;
  /** The trial's whole config, read for its `$globals` pins. */
  trialConfig: unknown;
  /** One copy's content, under the copy's globals and with the lens's args to write over the trial's config. */
  children: (globals: Globals, args: Readonly<Record<string, unknown>>) => ReactNode;
}

/** Props for `StoryCopy`. */
export interface StoryCopyProps {
  /** The story's own body props; a copy replaces `config`, `setConfig` and `globals`. */
  body: Omit<StoryBodyProps, 'globals'>;
  /** The trial's clock; a copy reads it and never drives it. */
  clock: ClockHandle | null;
  /** The timeline the story declares. */
  spec: TimelineSpec | null;
  globals: Globals;
  args: Readonly<Record<string, unknown>>;
}

/** A story trial's copy: its body under the copy's globals, with the lens's args written over its config. */
export function StoryCopy({ body, clock, spec, globals, args }: StoryCopyProps) {
  const { config, setConfig } = useCopyConfig(body.config, body.setConfig, args);
  return (
    <StoryClockProvider handle={clock} spec={spec}>
      <StoryBody {...body} config={config} setConfig={setConfig} globals={globals} />
    </StoryClockProvider>
  );
}

/** Whether a write to `path` would land on, inside or over the arg at `arg`. */
const covers = (arg: string, path: string) =>
  path === arg || path.startsWith(`${arg}.`) || arg.startsWith(`${path}.`);

const px = (n: number) => `${n}px`;

/** Where the copy sits in its slot: the host's own size, scaled by the factor about the hit point, which lands on the
 *  slot's center. Set as custom properties, which the stylesheet reads. */
function placement(request: LiveRequest): CSSProperties {
  const { hit, factor, size } = request;
  return {
    ['--fg-lens-copy-w' as string]: px(hit.host.offsetWidth),
    ['--fg-lens-copy-h' as string]: px(hit.host.offsetHeight),
    ['--fg-lens-copy-x' as string]: px(size.width / 2 - hit.local.x * factor),
    ['--fg-lens-copy-y' as string]: px(size.height / 2 - hit.local.y * factor),
    ['--fg-lens-copy-f' as string]: String(factor),
  } as CSSProperties;
}


/** Runs `sync` after every commit of the copy's content, which mounts a render after the copy's host does. */
function AfterCommit({ sync }: { sync: () => void }) {
  useLayoutEffect(sync);
  return null;
}

/** The globals a lens's copy renders under: the comparison resolved over the trial's own, pins included. */
function useCopyGlobals(request: LiveRequest, trialConfig: unknown): Globals {
  const labGlobals = useContext(StoryGlobalsContext);
  const pins = (trialConfig as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const own = useMemo(() => effectiveGlobals(labGlobals, pins), [labGlobals, pins]);
  const { compare, ctx } = request;
  return useMemo<Globals>(() => resolveComparison(compare, own, ctx).globals, [own, compare, ctx]);
}

/**
 * A copy's config and its writer: the trial's config with each of `args` written at its path, and a `setConfig`
 * that drops a write to any of them, since the comparison owns those, and passes every other write to the trial.
 */
export function useCopyConfig(
  trialConfig: unknown,
  trialSetConfig: (path: string, value: unknown) => void,
  args: Readonly<Record<string, unknown>>,
): { config: unknown; setConfig: (path: string, value: unknown) => void } {
  const config = useMemo(() => withArgs(trialConfig, args), [args, trialConfig]);
  // Keyed by the paths alone, so a comparison re-resolved to the same args keeps the story's `setConfig` stable.
  const argPaths = Object.keys(args).join('\n');
  const setConfig = useCallback(
    (path: string, value: unknown) => {
      const owned = argPaths === '' ? [] : argPaths.split('\n');
      if (!owned.some((arg) => covers(arg, path))) trialSetConfig(path, value);
    },
    [argPaths, trialSetConfig],
  );
  return { config, setConfig };
}

/** Portals a copy into its lens's slot, placed and scaled about the reticle's point. */
function LensPortal({ request, children }: { request: LiveRequest; children: ReactNode }) {
  return createPortal(
    <div className="fg-lens-copy" style={placement(request)}>
      {children}
    </div>,
    request.slot,
  );
}

const copyId = (trialId: string, request: LiveRequest) => `${trialId}~lens-${request.lensId}`;

/** The Live requests standing over `trialId`, re-read as they change. */
function useRequests(lenses: LiveLenses, trialId: string): readonly LiveRequest[] {
  const forTrial = useCallback(() => lenses.forTrial(trialId), [lenses, trialId]);
  return useSyncExternalStore(lenses.subscribe, forTrial);
}

function LensCopy({ request, trialId, layout, setup, trialConfig, children }: LiveCopiesProps & { request: LiveRequest; trialId: string }) {
  const globals = useCopyGlobals(request, trialConfig);
  const id = copyId(trialId, request);
  const copy = useMemo(() => ({ id, globals }), [id, globals]);

  const main = request.hit.host;
  const { slot } = request;
  // Found from the slot, not through the copy's host ref, which a re-render of the host detaches until after its
  // content's layout effects have run.
  const sync = useCallback(() => {
    const from = scrollerOf(main);
    const to = scrollerOf(slot.querySelector<HTMLElement>(':scope > .fg-lens-copy > [data-fg-copy]'));
    if (!from || !to) return;
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
  }, [main, slot]);
  useEffect(() => {
    const from = scrollerOf(main);
    from?.addEventListener('scroll', sync, { passive: true });
    return () => from?.removeEventListener('scroll', sync);
  }, [main, sync]);

  return (
    <LensPortal request={request}>
      {/* Remounted on a new factor: no observer sees a transform change, and a canvas inside sizes its backing
          store for the magnification it mounted under. */}
      <TrialHost key={request.factor} layout={layout} setup={setup} config={trialConfig} copy={copy}>
        {(g) => (
          <>
            {children(g, request.args)}
            <AfterCommit sync={sync} />
          </>
        )}
      </TrialHost>
    </LensPortal>
  );
}

function Copies({ lenses, trialId, ...props }: LiveCopiesProps & { lenses: LiveLenses; trialId: string }) {
  const requests = useRequests(lenses, trialId);
  return requests.map((request) => (
    <LensCopy key={request.lensId} request={request} trialId={trialId} {...props} />
  ));
}

/**
 * The trial's copies for the Live lenses over it: each a second render of its content, portaled into its lens, under
 * the lens's globals and args, following its scroll.
 */
export function LiveCopies(props: LiveCopiesProps) {
  const lenses = useContext(LiveLensesContext);
  const { trialId } = props;
  return lenses && trialId ? <Copies {...props} lenses={lenses} trialId={trialId} /> : null;
}

/**
 * What a lens's copy of an isolated story renders: its host id, the globals and args it renders under, the trial's
 * host, whose scroll it follows, and the factor the lens shows it at.
 */
export interface LensFrameCopy {
  id: string;
  main: HTMLElement;
  globals: Globals;
  args: Readonly<Record<string, unknown>>;
  factor: number;
}

/** Props for `LiveFrameCopies`. */
export interface LiveFrameCopiesProps {
  trialId: string | null;
  /** The trial's whole config, read for its `$globals` pins. */
  trialConfig: unknown;
  /** The trial's frame view in copy mode. */
  children: (copy: LensFrameCopy) => ReactNode;
}

function FrameLensCopy({ request, trialId, trialConfig, children }: Omit<LiveFrameCopiesProps, 'trialId'> & { request: LiveRequest; trialId: string }) {
  const globals = useCopyGlobals(request, trialConfig);
  const id = copyId(trialId, request);
  const { args, factor } = request;
  const main = request.hit.host;
  const copy = useMemo(() => ({ id, main, globals, args, factor }), [id, main, globals, args, factor]);
  return <LensPortal request={request}>{children(copy)}</LensPortal>;
}

function FrameCopies({ lenses, trialId, ...props }: Omit<LiveFrameCopiesProps, 'trialId'> & { lenses: LiveLenses; trialId: string }) {
  const requests = useRequests(lenses, trialId);
  return requests.map((request) => <FrameLensCopy key={request.lensId} request={request} trialId={trialId} {...props} />);
}

/**
 * The copies an isolated trial owes the Live lenses over it: each a frame of its own, portaled into its lens, under
 * the lens's globals and args, following its scroll. The trial's frame view renders itself as each copy, through
 * `children`.
 */
export function LiveFrameCopies(props: LiveFrameCopiesProps) {
  const lenses = useContext(LiveLensesContext);
  const { trialId } = props;
  return lenses && trialId ? <FrameCopies {...props} lenses={lenses} trialId={trialId} /> : null;
}
