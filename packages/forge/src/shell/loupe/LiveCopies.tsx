import './loupe.css';
import { withValueAtPath } from '@weasel-js/labkit/config';
import {
  type CSSProperties,
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
import type { Clock } from '../../timeline/clock';
import { ClockContext } from '../../timeline/context';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryBody, type StoryBodyProps } from '../StoryBody';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { TrialHost } from '../TrialHost';
import { type LiveLenses, LiveLensesContext, type LiveRequest } from './liveLenses';

/** Props for `LiveCopies`: what a trial renders its own story with, which every copy of it shares. */
export interface LiveCopiesProps {
  trialId: string | null;
  layout: Layout;
  setup: FrameSetup;
  /** The trial's whole config, read for its `$globals` pins. */
  trialConfig: unknown;
  /** The trial's clock; a copy reads it and never drives it. */
  clock: Clock | null;
  /** The story's own body props; a copy replaces `config`, `setConfig` and `globals`. */
  body: Omit<StoryBodyProps, 'globals'>;
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

const scrollerOf = (host: HTMLElement | null) => host?.querySelector<HTMLElement>(':scope > .fg-story__scroll') ?? null;

/** Runs `sync` after every commit of the copy's content, which mounts a render after the copy's host does. */
function AfterCommit({ sync }: { sync: () => void }) {
  useLayoutEffect(sync);
  return null;
}

function LensCopy({ request, trialId, layout, setup, trialConfig, clock, body }: LiveCopiesProps & { request: LiveRequest; trialId: string }) {

  const labGlobals = useContext(StoryGlobalsContext);
  const pins = (trialConfig as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const own = useMemo(() => effectiveGlobals(labGlobals, pins), [labGlobals, pins]);
  const globals = useMemo<Globals>(() => (request.globals ? { ...own, ...request.globals } : own), [own, request.globals]);
  const id = `${trialId}~lens-${request.lensId}`;
  const copy = useMemo(() => ({ id, globals }), [id, globals]);

  const { config: trialStoryConfig, setConfig: trialSetConfig } = body;
  const config = useMemo(
    () => Object.entries(request.args).reduce((c, [path, value]) => withValueAtPath(c, path, value), trialStoryConfig),
    [request.args, trialStoryConfig],
  );
  // Keyed by the paths alone, so a comparison re-resolved to the same args keeps the story's `setConfig` stable.
  const argPaths = Object.keys(request.args).join('\n');
  // The comparison owns the args it sets; any other write is the trial's.
  const setConfig = useCallback(
    (path: string, value: unknown) => {
      const owned = argPaths === '' ? [] : argPaths.split('\n');
      if (!owned.some((arg) => covers(arg, path))) trialSetConfig(path, value);
    },
    [argPaths, trialSetConfig],
  );

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

  return createPortal(
    <div className="fg-lens-copy" style={placement(request)}>
      <TrialHost layout={layout} setup={setup} config={trialConfig} copy={copy}>
        {(g) => (
          <ClockContext.Provider value={clock}>
            <StoryBody {...body} config={config} setConfig={setConfig} globals={g} />
            <AfterCommit sync={sync} />
          </ClockContext.Provider>
        )}
      </TrialHost>
    </div>,
    request.slot,
  );
}

function Copies({ lenses, trialId, ...props }: LiveCopiesProps & { lenses: LiveLenses; trialId: string }) {
  const forTrial = useCallback(() => lenses.forTrial(trialId), [lenses, trialId]);
  const requests = useSyncExternalStore(lenses.subscribe, forTrial);
  return requests.map((request) => (
    <LensCopy key={request.lensId} request={request} trialId={trialId} {...props} />
  ));
}

/**
 * The trial's copies for the Live lenses over it: each a second render of the story, portaled into its lens, under
 * the lens's globals and args, reading the trial's state and clock and following its scroll.
 */
export function LiveCopies(props: LiveCopiesProps) {
  const lenses = useContext(LiveLensesContext);
  const { trialId } = props;
  return lenses && trialId ? <Copies {...props} lenses={lenses} trialId={trialId} /> : null;
}
