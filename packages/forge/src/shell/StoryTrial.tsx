import type { RenderContext } from '@weasel-js/labkit';
import { type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import { StoryHost } from '../frame/StoryHost';
import type { Globals } from '../protocol/messages';
import type { LoadedStory, StoryContext } from '../story/types';
import { isGlobalsPath, storyConfig } from './globals';
import { TrialHost } from './TrialHost';

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

/** A story rendered in the workshop document, inside a `TrialHost`, from the trial's own config and state. */
export function StoryTrial({ story, setup, ctx, hostRef, onRendered, onError }: StoryTrialProps) {
  const latest = useRef(ctx);
  latest.current = ctx;
  const config = useMemo(() => storyConfig(ctx.config), [ctx.config]);

  // A trial opened on the provisional instrument starts at `null`; the story's own initial state fills it once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || ctx.state !== null || !story.initialState) return;
    seeded.current = true;
    ctx.setState(story.initialState(config));
  }, [ctx, story, config]);

  // Each new input retries a render the boundary caught, as the frame did on each message.
  const input = useRef({ config, state: ctx.state, key: 0 });
  if (input.current.config !== config || input.current.state !== ctx.state) {
    input.current = { config, state: ctx.state, key: input.current.key + 1 };
  }
  const resetKey = input.current.key;

  // Stable, as the frame's were: a story may list them as effect dependencies.
  // The pins belong to the trial; a story cannot see them, so it cannot set them either.
  const setConfig = useCallback((path: string, value: unknown) => {
    if (!isGlobalsPath(path)) latest.current.setConfig(path, value);
  }, []);
  const setState = useCallback((next: unknown) => latest.current.setState(next), []);

  const decorators = setup.decorators ?? [];
  const render = (globals: Globals) => {
    const storyCtx: StoryContext = {
      config,
      setConfig,
      state: ctx.state,
      setState,
      globals,
      title: story.title,
      name: story.name,
    };
    return (
      <StoryHost
        story={story}
        ctx={storyCtx}
        decorators={decorators}
        resetKey={resetKey}
        onError={(error) => onError?.(error)}
      />
    );
  };

  return (
    <TrialHost
      layout={story.layout}
      setup={setup}
      config={ctx.config}
      {...(hostRef ? { hostRef } : {})}
      {...(onRendered ? { onRendered } : {})}
    >
      {render}
    </TrialHost>
  );
}
