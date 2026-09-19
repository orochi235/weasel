import {
  type ComponentType,
  createContext,
  createElement,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Globals, Layout, Viewport } from '../protocol/messages';
import { storyId, storyNameFromExport } from '../story/ids';
import type { Decorator, LoadedStory, PlayContext, StoryContext } from '../story/types';
import { type ArgsScope, ArgsContext, appliedLocal, coverOf, type LocalArgs } from './argsContext';
import { type ArgType, argsToSchema, type ControlMatchers } from './argsToSchema';
import { isPlainObject } from './isPlainObject';
import { withUnsent } from './portSafe';

type Args = Record<string, unknown>;
type CsfContext = {
  args: Args;
  globals: Globals;
  parameters: Record<string, unknown>;
  title: string;
  name: string;
  id: string;
  viewMode: 'story';
};
type CsfRender = (args: Args, context: CsfContext) => ReactNode;
type CsfDecorator = (Story: ComponentType, context: CsfContext) => ReactNode;
type CsfPlay = (context: CsfContext & { canvasElement: HTMLElement; step: CsfStep }) => void | Promise<void>;
type CsfStep = (label: string, fn: () => void | Promise<void>) => Promise<void>;

interface Annotations {
  title?: string;
  name?: string;
  storyName?: string;
  component?: ComponentType<Args>;
  args?: Args;
  argTypes?: Record<string, ArgType>;
  parameters?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  decorators?: CsfDecorator | CsfDecorator[];
  render?: CsfRender;
  play?: CsfPlay;
  includeStories?: string[] | RegExp;
  excludeStories?: string[] | RegExp;
}

const LAYOUTS: readonly Layout[] = ['centered', 'padded', 'fullscreen'];

const asArray = <T,>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** Storybook's `deleteUndefined`, which its args store applies after every update. */
const withoutUndefined = (args: Args): Args =>
  Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));

/** Storybook's `matches` from `isExportStory`. */
const matches = (key: string, filter: string[] | RegExp) =>
  Array.isArray(filter) ? filter.includes(key) : key.match(filter) !== null;

/** Storybook's `combineParameters`: plain objects merge deeply, anything else is replaced. */
function combineParameters(...sources: (Record<string, unknown> | undefined)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (value === undefined) continue;
      out[key] = isPlainObject(value) && isPlainObject(out[key]) ? combineParameters(out[key], value) : value;
    }
  }
  return out;
}

function resolveViewport(parameters: Record<string, unknown>, globals: Record<string, unknown>): Viewport | null {
  const selected = globals.viewport as { value?: string; isRotated?: boolean } | undefined;
  const options = (parameters.viewport as { options?: Record<string, { styles?: { width?: string; height?: string } }> } | undefined)
    ?.options;
  const styles = selected?.value ? options?.[selected.value]?.styles : undefined;
  const px = (v: string | undefined) => (v && /^\d+(\.\d+)?px$/.test(v) ? Number.parseFloat(v) : Number.NaN);
  const width = px(styles?.width);
  const height = px(styles?.height);
  if (Number.isNaN(width) || Number.isNaN(height)) return null;
  return selected?.isRotated ? { width: height, height: width } : { width, height };
}

const InnerStory = createContext<(() => ReactNode) | null>(null);

function Story(): ReactNode {
  return useContext(InnerStory)?.() ?? null;
}

function Call({ fn }: { fn: () => ReactNode }): ReactNode {
  return fn();
}

interface StoryLocals {
  story: string;
  local: LocalArgs;
  setLocal: Dispatch<SetStateAction<LocalArgs>>;
}

const LocalArgsContext = createContext<StoryLocals | null>(null);

/** The outermost scope of a story holds its frame-local args, so its decorators and render share them. */
function Scoped({
  id,
  build,
  fn,
}: {
  id: string;
  build: (local: StoryLocals) => [ArgsScope, CsfContext];
  fn: (context: CsfContext) => ReactNode;
}): ReactNode {
  const outer = useContext(LocalArgsContext);
  const [local, setLocal] = useState<LocalArgs>({});
  const shared = outer?.story === id ? outer : { story: id, local, setLocal };
  const [scope, context] = build(shared);
  const { config } = scope;
  const prune = shared.setLocal;
  // An entry config has moved past must not come back if config later returns to the value it covered.
  useEffect(() => {
    prune((prev) => {
      const kept = Object.entries(prev).filter(([key, entry]) => coverOf(config[key]) === entry.over);
      return kept.length === Object.keys(prev).length ? prev : Object.fromEntries(kept);
    });
  }, [config, prune]);
  return createElement(
    LocalArgsContext.Provider,
    { value: shared },
    createElement(ArgsContext.Provider, { value: scope }, createElement(Call, { fn: () => fn(context) })),
  );
}

/**
 * Normalizes a Component Story Format module. `autoTitle` titles the stories when the meta names no title;
 * `parameters` are the project's, under the meta's and each story's.
 */
export function loadCsfModule(
  mod: Record<string, unknown>,
  autoTitle: string,
  projectParameters: Record<string, unknown> = {},
): LoadedStory[] {
  const meta = (isPlainObject(mod.default) ? mod.default : {}) as Annotations;
  const title = meta.title ?? autoTitle;
  const stories: LoadedStory[] = [];

  for (const [exportName, value] of Object.entries(mod)) {
    if (exportName === 'default' || exportName === '__namedExportsOrder' || exportName === '__esModule') continue;
    if (meta.includeStories && !matches(exportName, meta.includeStories)) continue;
    if (meta.excludeStories && matches(exportName, meta.excludeStories)) continue;
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;

    // A CSF 2 function export hoists its annotations onto itself.
    const spec: Annotations = typeof value === 'function' ? { ...value, render: value as CsfRender } : (value as Annotations);
    const id = storyId(title, exportName);
    const name = spec.name || spec.storyName || storyNameFromExport(exportName);
    const args = { ...meta.args, ...spec.args };
    const parameters = combineParameters(projectParameters, meta.parameters, spec.parameters);
    const matchers = (parameters.controls as { matchers?: ControlMatchers } | undefined)?.matchers;
    const config = argsToSchema(
      args,
      combineParameters(meta.argTypes, spec.argTypes) as Record<string, ArgType>,
      isPlainObject(matchers) ? matchers : {},
    );
    const defaults = config.defaults() as Args;
    const storyGlobals = { ...meta.globals, ...spec.globals };
    const component = meta.component;
    const renderFn: CsfRender | undefined =
      spec.render ?? meta.render ?? (component ? (a) => createElement(component, a) : undefined);

    const withArgs = (config: Args): Args =>
      Object.fromEntries(
        Object.entries(withoutUndefined(config)).map(([key, value]) => [key, key in args ? withUnsent(value, args[key]) : value]),
      );
    const csfContext = (config: unknown, globals: Globals, local: LocalArgs = {}): CsfContext => ({
      args: withoutUndefined({ ...args, ...withArgs(config as Args), ...appliedLocal(local, config as Args) }),
      globals,
      parameters,
      title,
      name,
      id,
      viewMode: 'story',
    });
    const scoped = (ctx: StoryContext, fn: (context: CsfContext) => ReactNode): ReactNode =>
      createElement(Scoped, {
        id,
        build: ({ local, setLocal }: StoryLocals): [ArgsScope, CsfContext] => {
          const context = csfContext(ctx.config, ctx.globals, local);
          const scope: ArgsScope = {
            args: context.args,
            config: ctx.config as Args,
            defaults,
            original: args,
            setConfig: ctx.setConfig,
            setLocal,
          };
          return [scope, context];
        },
        fn,
      });

    const adapt =
      (decorator: CsfDecorator): Decorator =>
      (inner, ctx) =>
        createElement(
          InnerStory.Provider,
          { value: inner },
          scoped(ctx, (context) => decorator(Story, context)),
        );

    const layout = parameters.layout as Layout | undefined;
    const play = spec.play ?? meta.play;

    stories.push({
      id,
      title,
      name,
      exportName,
      config,
      initialState: null,
      render: (ctx) => {
        if (!renderFn) return null;
        return scoped(ctx, (context) => renderFn(context.args, context));
      },
      decorators: [...asArray(spec.decorators), ...asArray(meta.decorators)].map(adapt),
      layout: layout && LAYOUTS.includes(layout) ? layout : 'padded',
      viewport: resolveViewport(parameters, storyGlobals),
      play: play
        ? ({ canvasElement, config, globals }: PlayContext) =>
            play({ ...csfContext(config, globals), canvasElement, step: async (_label, fn) => fn() })
        : null,
    });
  }
  return stories;
}
