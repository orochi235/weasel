/**
 * The CSF surface forge reads, as types a story file can annotate itself with.
 *
 * Component Story Format is a plain-module convention — a default export of
 * meta, one named export per story — and forge's loader (`loadCsfModule`)
 * implements it directly. These types are that loader's `Annotations`
 * interface made public, so a CSF file is typed by the tool that runs it.
 *
 * They are deliberately narrower than Storybook's: what is here is what forge
 * reads. A field forge ignores is a field a story should not be writing.
 */
import type { ComponentType, ReactNode } from 'react';
import type { Globals } from '../protocol/messages';
import type { ArgType } from './argsToSchema';

/** The props a story's args describe: a component type resolves to its props,
 *  and a bare props type stands for itself. */
export type ArgsOf<T> = T extends ComponentType<infer P> ? P : T;

/** What a `render`, `decorators` entry or `play` is handed alongside the args. */
export interface CsfStoryContext {
  args: Record<string, unknown>;
  globals: Globals;
  parameters: Record<string, unknown>;
  title: string;
  name: string;
  id: string;
  viewMode: 'story';
}

/** Groups a play function's steps for reporting. */
export type CsfStep = (label: string, fn: () => void | Promise<void>) => Promise<void>;

/** What a `play` is handed: the story context, the element the story mounted
 *  into, and `step`. */
export interface CsfPlayContext extends CsfStoryContext {
  canvasElement: HTMLElement;
  step: CsfStep;
}

/** Wraps a story. `Story` renders whatever it wraps — the next decorator in,
 *  or the story itself. */
export type CsfDecorator = (Story: ComponentType, context: CsfStoryContext) => ReactNode;

/** Fields a meta and a story both accept. A story's value wins. */
interface Shared<T> {
  args?: Partial<ArgsOf<T>>;
  argTypes?: Partial<Record<keyof ArgsOf<T> & string, ArgType>> & Record<string, ArgType>;
  parameters?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  decorators?: CsfDecorator | CsfDecorator[];
  render?: (args: ArgsOf<T>, context: CsfStoryContext) => ReactNode;
  play?: (context: CsfPlayContext) => void | Promise<void>;
}

/** A CSF file's default export: what its stories share, and where they sit in
 *  the sidebar. */
export interface Meta<T = unknown> extends Shared<T> {
  /** Sidebar path, `/`-separated. Derived from the file's location when omitted. */
  title?: string;
  component?: ComponentType<ArgsOf<T>>;
  /** Named exports to index as stories. Everything not excluded, by default. */
  includeStories?: string[] | RegExp;
  excludeStories?: string[] | RegExp;
}

/** One story: a named export of a CSF file. */
export interface StoryObj<T = unknown> extends Shared<T> {
  /** Overrides the name derived from the export's identifier. */
  name?: string;
  /** Storybook's older spelling of `name`; forge reads both. */
  storyName?: string;
}
