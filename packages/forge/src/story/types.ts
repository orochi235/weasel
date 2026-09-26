import type { ConfigSchema } from '@weasel-js/labkit/config';
import type { ComponentType, ReactNode } from 'react';
import type { Globals, Layout, Viewport } from '../protocol/messages.ts';

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
  /** Renders this story in its own frame document, for a reason the value states. The default is the workshop document. */
  isolate?: string;
  /** The component's own index page, in place of the generated one. A CSF file sets `parameters.forge.index`. */
  index?: IndexRender;
}

/** What an index page is given: its component's stories, and the parts the generated page is built from. */
export interface IndexContext {
  title: string;
  /** The JSDoc above the file's meta, if any. */
  description?: string;
  /** In file order. */
  stories: readonly LoadedStory[];
  globals: Globals;
  /** One story, interactive, at its defaults with `config` over them. */
  Story: ComponentType<IndexStoryProps>;
  /** One story rendered once per value of each of its boolean and enum controls, the rest at their defaults. */
  Variants: ComponentType<{ story: LoadedStory }>;
  /** The whole generated page. */
  DefaultIndex: ComponentType;
  /** Shows story `id` in this page's trial in its place. */
  open: (id: string) => void;
}

export interface IndexStoryProps {
  story: LoadedStory;
  /** Merged over the story's defaults; nested groups merge rather than replace. */
  config?: Record<string, unknown>;
  /** Shown under the story. */
  label?: string;
}

export type IndexRender = (ctx: IndexContext) => ReactNode;

export interface StorySpec<C = Record<string, never>, S = undefined> {
  name?: string;
  config?: ConfigSchema<C>;
  state?: (config: C) => S;
  render: (ctx: StoryContext<C, S>) => ReactNode;
  decorators?: Decorator[];
  layout?: Layout;
  viewport?: Viewport;
  /** Renders this story in its own frame document, for a reason the value states. The default is the workshop document. */
  isolate?: string;
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
  isolate: string | null;
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
  /** The JSDoc written above this story's export, if any. */
  description?: string;
  /** The JSDoc written above the file's meta, if any. */
  componentDescription?: string;
  /** The identifier the meta's `component` names, if it names one. */
  componentName?: string;
  /** Read statically from the source; a story with it renders in its own frame. */
  isolate?: string;
}
