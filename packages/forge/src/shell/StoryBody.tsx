import { memo } from 'react';
import { StoryHost } from '../frame/StoryHost';
import type { Globals } from '../protocol/messages';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';

export interface StoryBodyProps {
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
export const StoryBody = memo(function StoryBody({ story, config, setConfig, state, setState, globals, decorators, resetKey, onError }: StoryBodyProps) {
  const storyCtx: StoryContext = { config, setConfig, state, setState, globals, title: story.title, name: story.name };
  return <StoryHost story={story} ctx={storyCtx} decorators={decorators} resetKey={resetKey} onError={onError} />;
});
