import { withValueAtPath } from '@weasel-js/labkit/config';
import { type RefObject, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FrameSetup } from '../frame/FrameController';
import type { Viewport } from '../protocol/messages';
import { StoryTrial } from '../shell/StoryTrial';
import { loadStories } from '../story/load';
import type { LoadedStory } from '../story/types';

/** Prefixes `error` with the phase it came from, keeping its stack. */
function phased(phase: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const out = new Error(`${phase} fault: ${message}`, { cause: error });
  if (error instanceof Error && error.stack) out.stack = `${phase} fault: ${error.stack}`;
  return out;
}

const settle = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

interface TestTrialProps {
  story: LoadedStory;
  setup: FrameSetup;
  hostRef: RefObject<HTMLElement | null>;
  /** The config in force after each commit, so `play` reads what the story last wrote. */
  onConfig: (config: unknown) => void;
  onRendered: () => void;
  onError: (error: unknown) => void;
}

/** The trial a story test runs in: its config and state, held the way a lab trial holds them. */
function TestTrial({ story, setup, hostRef, onConfig, onRendered, onError }: TestTrialProps) {
  const [config, setConfigState] = useState<unknown>(() => story.config.defaults());
  const [state, setState] = useState<unknown>(null);
  useEffect(() => onConfig(config), [config, onConfig]);
  const ctx = {
    config,
    state,
    setConfig: (path: string, value: unknown) => setConfigState((prev: unknown) => withValueAtPath(prev, path, value)),
    setState,
  };
  return <StoryTrial story={story} setup={setup} ctx={ctx} hostRef={hostRef} onRendered={onRendered} onError={onError} />;
}

export interface RunStoryOptions {
  /** The frame config (`frameConfig`). */
  setup?: FrameSetup;
  /** Resizes the page, for a story that names a viewport. Without it, stories run at whatever size the page is. */
  viewport?: (width: number, height: number) => Promise<void>;
}

/** Stops the story a timed-out test left mounted. */
let leftover: (() => unknown) | null = null;
/** The page's size before any story resized it; a story with no viewport runs at this size. */
let pageSize: Viewport | null = null;

/**
 * Renders one story in the test page the way the workshop does — defaults, no state, no globals — then plays it.
 * Throws on a render the story's boundary caught, or a play function that fails.
 */
export async function runStory(
  mod: Record<string, unknown>,
  exportName: string,
  file: string,
  autoTitle: string,
  { setup = {}, viewport }: RunStoryOptions = {},
): Promise<void> {
  leftover?.();
  let story: LoadedStory | undefined;
  try {
    story = loadStories(mod, autoTitle, setup.parameters).find((s) => s.exportName === exportName);
  } catch (error) {
    throw phased('load', error);
  }
  if (!story) throw new Error(`load fault: ${file} has no story export "${exportName}"`);

  pageSize ??= { width: window.innerWidth, height: window.innerHeight };
  const size = story.viewport ?? pageSize;
  if (viewport && (window.innerWidth !== size.width || window.innerHeight !== size.height)) {
    await viewport(size.width, size.height);
  }

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | undefined;
  /** Returns what unmounting threw, having released everything else regardless. */
  const cleanup = (): { error: unknown } | null => {
    if (leftover === cleanup) leftover = null;
    let thrown: { error: unknown } | null = null;
    try {
      root?.unmount();
    } catch (error) {
      thrown = { error };
    } finally {
      root = undefined;
      container.remove();
    }
    return thrown;
  };
  leftover = cleanup;

  const hostRef: RefObject<HTMLElement | null> = { current: null };
  let config: unknown;
  let renderError: { error: unknown } | null = null;
  let markRendered: () => void = () => {};
  const rendered = new Promise<void>((resolve) => {
    markRendered = resolve;
  });
  const fail = (error: unknown) => {
    renderError ??= { error };
    // An error the boundary could not catch leaves nothing to announce `rendered`; the check below throws instead.
    markRendered();
  };
  const checkRender = () => {
    if (renderError) throw phased('render', renderError.error);
  };

  let failure: { error: unknown } | null = null;
  try {
    try {
      await setup.prepare?.(story);
      root = createRoot(container, { onUncaughtError: fail });
      root.render(
        <TestTrial
          story={story}
          setup={setup}
          hostRef={hostRef}
          onConfig={(next) => {
            config = next;
          }}
          onRendered={markRendered}
          onError={fail}
        />,
      );
    } catch (error) {
      throw phased('mount', error);
    }
    await rendered;
    await settle();
    checkRender();
    const host = hostRef.current;
    if (!host) throw new Error('render fault: the story host never mounted');
    if (story.play) {
      try {
        await story.play({ canvasElement: host, config, globals: {} });
      } catch (error) {
        throw phased('play', error);
      }
      await settle();
      checkRender();
    }
  } catch (error) {
    failure = { error };
  }
  const cleanupError = cleanup();
  if (failure) throw failure.error;
  if (cleanupError) throw phased('cleanup', cleanupError.error);
}
