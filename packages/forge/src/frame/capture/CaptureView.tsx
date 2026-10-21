import './capture.css';
import { useLatest, useVisibleRaf } from '@weasel-js/core';
import { interstellarTheme, LabRoot } from '@weasel-js/labkit';
import type { Theme } from '@weasel-js/theme';
import { ThemeProvider } from '@weasel-js/theme/react';
import { OverlayPortalProvider } from '@weasel-js/ui/portal-host';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useHostConditions } from '../../shell/hostConditions';
import { LAB_DENSITY } from '../../shell/labDensity';
import type { Globals } from '../../protocol/messages';
import type { LoadedStory, StoryContext } from '../../story/types';
import { ClockContext } from '../../timeline/context';
import { useStoryClock } from '../../timeline/StoryClock';
import type { CapturePayload } from '../../vite/capture/payload';
import type { FrameSetup } from '../FrameController';
import { StoryHost } from '../StoryHost';

/** Props for `CaptureView`. */
export interface CaptureViewProps {
  story: LoadedStory;
  payload: CapturePayload;
  setup: FrameSetup;
  /** The shell config's `labTheme`, which the workshop's lab is themed by. */
  labTheme?: ((globals: Globals) => Theme) | undefined;
  /** Called once the story has painted with its fonts, so a screenshot taken then shows it settled. */
  onRendered: () => void;
}

const HOST_ID = 'capture';
const NO_WRITE = () => {};

/** Sizes the box through custom properties, which capture.css reads. */
const boxStyle = ({ width, height }: CapturePayload['box']): CSSProperties =>
  ({ ['--fg-capture-w' as string]: `${width}px`, ['--fg-capture-h' as string]: `${height}px` }) as CSSProperties;

/**
 * One story rendered from a capture payload, still: its clock stands at the payload's playhead and nothing plays
 * it, and nothing it writes to its config or state goes anywhere. A story that would be in the workshop document
 * sits under a lab root themed as the lab is, as it does there; an isolated one sits in the frame document's own
 * wrapper.
 */
export function CaptureView({ story, payload, setup, labTheme, onRendered }: CaptureViewProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useHostConditions(host, { hostId: HOST_ID, globals: payload.globals, overrides: payload.overrides, setup });

  const spec = useMemo(() => story.timeline?.(payload.config) ?? null, [story, payload.config]);
  const clock = useStoryClock(spec, () => payload.playhead);

  const state = useMemo(
    () => (payload.state === null && story.initialState ? story.initialState(payload.config) : payload.state),
    [payload.state, payload.config, story],
  );
  const ctx: StoryContext = {
    config: payload.config,
    setConfig: NO_WRITE,
    state,
    setState: NO_WRITE,
    globals: payload.globals,
    title: story.title,
    name: story.name,
  };

  const latest = useLatest(onRendered);
  const ticks = useRef(0);
  // A capture page is never looked at, and a headless page can count as hidden.
  const raf = useVisibleRaf(
    (_now, loop) => {
      ticks.current += 1;
      if (ticks.current < 2) loop.request();
      else latest.current();
    },
    { dangerouslyRunWhenHidden: true },
  );
  useEffect(() => {
    if (!host) return;
    let canceled = false;
    const start = () => {
      if (!canceled) raf.request();
    };
    const { fonts } = host.ownerDocument;
    if (fonts) void fonts.ready.then(start, start);
    else start();
    return () => {
      canceled = true;
      raf.cancel();
    };
  }, [host, raf]);

  const content: ReactNode = host ? (
    <ClockContext.Provider value={clock}>
      <StoryHost story={story} ctx={ctx} decorators={setup.decorators ?? []} resetKey={0} onError={NO_WRITE} />
    </ClockContext.Provider>
  ) : null;

  const box = (
    <div
      ref={setHost}
      className="fg-story"
      data-fg-host={HOST_ID}
      data-fg-capture=""
      data-fg-layout={payload.layout}
      style={boxStyle(payload.box)}
    >
      {payload.isolate ? (
        <div className={`fg-frame fg-frame--${payload.layout}`}>{content}</div>
      ) : (
        <div className="fg-story__scroll">
          {host ? (
            <OverlayPortalProvider container={host} contained>
              {content}
            </OverlayPortalProvider>
          ) : null}
        </div>
      )}
    </div>
  );
  if (payload.isolate) return box;
  return (
    <ThemeProvider
      theme={labTheme?.(payload.lab.globals) ?? interstellarTheme}
      selection={{ mode: payload.lab.mode, density: LAB_DENSITY }}
    >
      <LabRoot>{box}</LabRoot>
    </ThemeProvider>
  );
}
