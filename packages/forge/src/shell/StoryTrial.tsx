import { type RenderContext, TrialIdContext } from '@weasel-js/labkit';
import { useLatest } from '@weasel-js/core';
import { type RefObject, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import type { Globals } from '../protocol/messages';
import type { Decorator, LoadedStory } from '../story/types';
import { ClockContext } from '../timeline/context';
import { useStoryClock } from '../timeline/StoryClock';
import { TrialClocksContext } from '../timeline/trialClocks';
import { useClockLoop } from '../timeline/useClockLoop';
import { usePersistedPlayhead } from '../timeline/usePersistedPlayhead';
import { isForgePath, PLAYHEAD_KEY, storyConfig } from './globals';
import { LiveCopies, StoryCopy } from './loupe/LiveCopies';
import { StoryBody } from './StoryBody';
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

/** A story rendered in the workshop document, inside a `TrialHost`, from the trial's own config and state. */
export function StoryTrial({ story, setup, ctx, hostRef, onRendered, onError }: StoryTrialProps) {
  const latestRef = useLatest(ctx);
  // Kept across a write to a key forge owns, so moving the playhead or a pin does not re-render the story.
  const [heldConfig, setHeldConfig] = useState(() => storyConfig(ctx.config));
  const config = storyConfig(ctx.config, heldConfig);
  if (config !== heldConfig) setHeldConfig(config);

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
    if (!isForgePath(path)) latestRef.current.setConfig(path, value);
  }, [latestRef]);
  const setState = useCallback((next: unknown) => latestRef.current.setState(next), [latestRef]);

  // The story's clock lives with its trial: the trial's transport reads it from the registry, the story from context.
  const trialId = useContext(TrialIdContext);
  const clocks = useContext(TrialClocksContext);
  const ownHost = useRef<HTMLElement | null>(null);
  const host = hostRef ?? ownHost;
  const kept = (ctx.config as Record<string, unknown> | null)?.[PLAYHEAD_KEY];
  const persisted = typeof kept === 'number' && Number.isFinite(kept) ? kept : null;
  const clock = useStoryClock(story.timeline?.(config) ?? null, () => persisted);
  useClockLoop(clock, host);
  usePersistedPlayhead(clock, persisted, (time) => latestRef.current.setConfig(PLAYHEAD_KEY, time));
  useEffect(() => (clock && clocks && trialId ? clocks.publish(trialId, clock) : undefined), [clock, clocks, trialId]);

  const decorators = setup.decorators ?? NO_DECORATORS;
  const latestError = useLatest(onError);
  const reportError = useCallback((error: unknown) => latestError.current?.(error), [latestError]);
  const body = {
    story,
    config,
    setConfig,
    state: ctx.state,
    setState,
    decorators,
    resetKey,
    onError: reportError,
  };
  const render = (globals: Globals) => (
    <ClockContext.Provider value={clock}>
      <StoryBody {...body} globals={globals} />
    </ClockContext.Provider>
  );

  return (
    <>
      <TrialHost
        layout={story.layout}
        setup={setup}
        config={ctx.config}
        hostRef={host}
        {...(onRendered ? { onRendered } : {})}
      >
        {render}
      </TrialHost>
      <LiveCopies trialId={trialId} layout={story.layout} setup={setup} trialConfig={ctx.config}>
        {(globals, args) => <StoryCopy body={body} clock={clock} globals={globals} args={args} />}
      </LiveCopies>
    </>
  );
}
