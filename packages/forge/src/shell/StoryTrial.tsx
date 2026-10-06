import { type RenderContext, TrialIdContext } from '@weasel-js/labkit';
import { useLatest } from '@weasel-js/core';
import { memo, type RefObject, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import { StoryHost } from '../frame/StoryHost';
import type { Globals } from '../protocol/messages';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';
import { ClockContext } from '../timeline/context';
import { initialPlayhead } from '../timeline/playheadUrl';
import { useStoryClock } from '../timeline/StoryClock';
import { TrialClocksContext } from '../timeline/trialClocks';
import { useClockLoop } from '../timeline/useClockLoop';
import { useHeldPlayhead } from '../timeline/useHeldPlayhead';
import { isGlobalsPath, storyConfig } from './globals';
import { TrialHost } from './TrialHost';

/** Props for `StoryTrial`. */
export interface StoryTrialProps {
  story: LoadedStory;
  setup: FrameSetup;
  /** The trial's config and state; the story reads and writes them through its `StoryContext`. */
  ctx: Pick<RenderContext<unknown, unknown>, 'config' | 'state' | 'setConfig' | 'setState'>;
  hostRef?: RefObject<HTMLElement | null>;
  onRendered?: () => void;
  /** A render throw, after the boundary has shown it. */
  onError?: (error: unknown) => void;
}

const NO_DECORATORS: readonly Decorator[] = [];

interface StoryBodyProps {
  story: LoadedStory;
  config: StoryContext['config'];
  setConfig: StoryContext['setConfig'];
  state: unknown;
  setState: StoryContext['setState'];
  globals: Globals;
  decorators: readonly Decorator[];
  resetKey: number;
  onError: (error: unknown) => void;
}

/** Calls `render` only when its inputs change, as Storybook does: the lab re-renders a trial for its own reasons, and a
 *  story declaring a component inside `render` remounts it on every extra call. */
const StoryBody = memo(function StoryBody({ story, config, setConfig, state, setState, globals, decorators, resetKey, onError }: StoryBodyProps) {
  const storyCtx: StoryContext = { config, setConfig, state, setState, globals, title: story.title, name: story.name };
  return <StoryHost story={story} ctx={storyCtx} decorators={decorators} resetKey={resetKey} onError={onError} />;
});

/** A story rendered in the workshop document, inside a `TrialHost`, from the trial's own config and state. */
export function StoryTrial({ story, setup, ctx, hostRef, onRendered, onError }: StoryTrialProps) {
  const latest = useLatest(ctx);
  const config = useMemo(() => storyConfig(ctx.config), [ctx.config]);

  // A trial opened on the provisional instrument starts at `null`; the story's own initial state fills it once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || ctx.state !== null || !story.initialState) return;
    seeded.current = true;
    ctx.setState(story.initialState(config));
  }, [ctx, story, config]);

  // Each new input retries a render the boundary caught, as the frame did on each message.
  // State, not a ref: a render React throws away takes its bump with it.
  const [input, setInput] = useState({ config, state: ctx.state, key: 0 });
  let resetKey = input.key;
  if (input.config !== config || input.state !== ctx.state) {
    resetKey = input.key + 1;
    setInput({ config, state: ctx.state, key: resetKey });
  }

  // Stable, as the frame's were: a story may list them as effect dependencies.
  // The pins belong to the trial; a story cannot see them, so it cannot set them either.
  const setConfig = useCallback((path: string, value: unknown) => {
    if (!isGlobalsPath(path)) latest.current.setConfig(path, value);
  }, [latest]);
  const setState = useCallback((next: unknown) => latest.current.setState(next), [latest]);

  // The story's clock lives with its trial: the trial's transport reads it from the registry, the story from context.
  const trialId = useContext(TrialIdContext);
  const clocks = useContext(TrialClocksContext);
  const ownHost = useRef<HTMLElement | null>(null);
  const host = hostRef ?? ownHost;
  const clock = useStoryClock(story.timeline?.(config) ?? null, () => initialPlayhead(story.id));
  useClockLoop(clock, host);
  useHeldPlayhead(clock, story.id);
  useEffect(() => (clock && clocks && trialId ? clocks.publish(trialId, clock) : undefined), [clock, clocks, trialId]);

  const decorators = setup.decorators ?? NO_DECORATORS;
  const latestError = useLatest(onError);
  const reportError = useCallback((error: unknown) => latestError.current?.(error), [latestError]);
  const render = (globals: Globals) => (
    <ClockContext.Provider value={clock}>
      <StoryBody
        story={story}
        config={config}
        setConfig={setConfig}
        state={ctx.state}
        setState={setState}
        globals={globals}
        decorators={decorators}
        resetKey={resetKey}
        onError={reportError}
      />
    </ClockContext.Provider>
  );

  return (
    <TrialHost
      layout={story.layout}
      setup={setup}
      config={ctx.config}
      hostRef={host}
      {...(onRendered ? { onRendered } : {})}
    >
      {render}
    </TrialHost>
  );
}
