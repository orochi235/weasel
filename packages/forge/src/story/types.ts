import type { ConfigSchema } from '@weasel-js/labkit/config';
import type { ReactNode } from 'react';
import type { Globals, Layout, Viewport } from '../protocol/messages';

export interface StoryContext<C = unknown, S = unknown> {
  config: C;
  setConfig: (path: string, value: unknown) => void;
  state: S;
  setState: (next: S | ((prev: S) => S)) => void;
  globals: Globals;
  title: string;
  name: string;
}

export interface PlayContext<C = unknown> {
  canvasElement: HTMLElement;
  config: C;
  globals: Globals;
}

export type Decorator = (story: () => ReactNode, ctx: StoryContext) => ReactNode;

export interface MetaSpec {
  title?: string;
  decorators?: Decorator[];
  layout?: Layout;
}

export interface StorySpec<C = Record<string, never>, S = undefined> {
  name?: string;
  config?: ConfigSchema<C>;
  state?: (config: C) => S;
  render: (ctx: StoryContext<C, S>) => ReactNode;
  decorators?: Decorator[];
  layout?: Layout;
  viewport?: Viewport;
  play?: (ctx: PlayContext<C>) => void | Promise<void>;
}

/** One story, normalized — what both the native and CSF loaders produce. */
export interface LoadedStory {
  id: string;
  title: string;
  name: string;
  exportName: string;
  config: ConfigSchema<unknown>;
  initialState: ((config: unknown) => unknown) | null;
  render: (ctx: StoryContext) => ReactNode;
  /** Innermost first: the story's own, then the meta's. Global decorators are added by the frame. */
  decorators: Decorator[];
  layout: Layout;
  viewport: Viewport | null;
  play: ((ctx: PlayContext) => void | Promise<void>) | null;
}

/** One story as the index knows it, before its module is loaded. */
export interface IndexEntry {
  id: string;
  title: string;
  name: string;
  exportName: string;
  /** Absolute path of the story file. */
  file: string;
}
