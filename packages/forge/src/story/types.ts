import type { ConfigSchema } from '@weasel-js/labkit/config';
import type { ComponentType, ReactNode } from 'react';
import type { Globals, Layout, Viewport } from '../protocol/messages.ts';
import type { TimelineSpec } from '../timeline/clock.ts';

/** What a story's `render` and its decorators receive: the trial's config and state, the globals in force, and the
 *  story's own title and name. */
export interface StoryContext<C = unknown, S = unknown> {
  config: C;
  setConfig: (path: string, value: unknown) => void;
  state: S;
  setState: (next: S | ((prev: S) => S)) => void;
  globals: Globals;
  title: string;
  name: string;
}

/** What a story's `play` receives. `canvasElement` is the element the story rendered into. */
export interface PlayContext<C = unknown> {
  canvasElement: HTMLElement;
  config: C;
  globals: Globals;
}

/** Wraps a story: `story()` renders what it wraps, and the decorator returns that inside whatever it adds. */
export type Decorator = (story: () => ReactNode, ctx: StoryContext) => ReactNode;

/** What `meta()` takes: settings every story in the file shares. */
export interface MetaSpec {
  title?: string;
  decorators?: Decorator[];
  layout?: Layout;
  /** Renders this story in its own frame document, for a reason the value states. The default is the workshop document. */
  isolate?: string;
  /** The component's own index page, in place of the generated one. A CSF file sets `parameters.forge.index`. */
  index?: IndexRender;
  /** As CSF's meta `tags`; `'gallery'` marks a catalog or showcase rather than one component. Read from the source,
   *  so each must be a string literal. */
  tags?: readonly string[];
  /** Gives every story in the file a playhead and a transport, unless the story declares its own. */
  timeline?: TimelineSpec | ((config: Record<string, unknown>) => TimelineSpec);
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
  /** The listed components this one uses and those that use it, as the generated page shows them. */
  Dependencies: ComponentType;
  /** Whether the meta is tagged `gallery`. */
  gallery: boolean;
  /** Shows story `id` in this page's trial in its place. */
  open: (id: string) => void;
}

/** Props for `IndexContext.Story`. */
export interface IndexStoryProps {
  story: LoadedStory;
  /** Merged over the story's defaults; nested groups merge rather than replace. */
  config?: Record<string, unknown>;
  /** Shown under the story. */
  label?: string;
}

/** A custom index page for a component, given as `MetaSpec.index`. */
export type IndexRender = (ctx: IndexContext) => ReactNode;

/** What `story()` takes. `config` declares the story's controls; `state`, given, seeds its state from the config. */
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
  /** Added to the meta's `tags`; `'!tag'` drops one. Read from the source, so each must be a string literal. */
  tags?: readonly string[];
  /** Gives the story a playhead, which it reads with `usePlayhead` or `useTimeline`, and its trial a transport. A
   *  function is handed the trial's config, for a span that follows a control. */
  timeline?: TimelineSpec | ((config: C) => TimelineSpec);
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
  /** The timeline the story declares, for a config; null when it declares none. */
  timeline: ((config: unknown) => TimelineSpec) | null;
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
  /** The story's tags, read statically from the source: its meta's and its own. An index page's are those every
   *  story of its component carries. */
  tags?: string[];
}

/** One component's place in the component graph. Every list holds story titles, sorted. */
export interface ComponentDeps {
  /** The file declaring the component, relative to the vite root; null when forge could not find one. */
  source: string | null;
  /** The listed components its own source imports. */
  uses: string[];
  /** The listed components whose own source imports it. */
  usedBy: string[];
}

/** The component graph the vite plugin derives from source, by story title. A gallery has no entry. */
export type DepGraph = Record<string, ComponentDeps>;
