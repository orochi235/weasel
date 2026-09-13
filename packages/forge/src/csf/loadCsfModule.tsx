import {
  type ComponentType,
  createContext,
  createElement,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';
import type { Globals, Layout, Viewport } from '../protocol/messages';
import { storyId, storyNameFromExport, titleFromFile } from '../story/ids';
import type { Decorator, LoadedStory, PlayContext, StoryContext } from '../story/types';
import { type ArgsScope, ArgsContext } from './argsContext';
import { type ArgType, argsToSchema } from './argsToSchema';
import { isPlainObject } from './isPlainObject';

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

interface LocalArgs {
  story: string;
  local: Args;
  setLocal: Dispatch<SetStateAction<Args>>;
}

const LocalArgsContext = createContext<LocalArgs | null>(null);

/** The outermost scope of a story holds its frame-local args, so its decorators and render share them. */
function Scoped({
  id,
  build,
  fn,
}: {
  id: string;
  build: (local: LocalArgs) => [ArgsScope, CsfContext];
  fn: (context: CsfContext) => ReactNode;
}): ReactNode {
  const outer = useContext(LocalArgsContext);
  const [local, setLocal] = useState<Args>({});
  const shared = outer?.story === id ? outer : { story: id, local, setLocal };
  const [scope, context] = build(shared);
  return createElement(
    LocalArgsContext.Provider,
    { value: shared },
    createElement(ArgsContext.Provider, { value: scope }, createElement(Call, { fn: () => fn(context) })),
  );
}

/** Normalizes a Component Story Format module. */
export function loadCsfModule(mod: Record<string, unknown>, file: string, root: string): LoadedStory[] {
  const meta = (isPlainObject(mod.default) ? mod.default : {}) as Annotations;
  const title = meta.title ?? titleFromFile(file, root);
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
    const config = argsToSchema(args, combineParameters(meta.argTypes, spec.argTypes) as Record<string, ArgType>);
    const defaults = config.defaults() as Args;
    const parameters = combineParameters(meta.parameters, spec.parameters);
    const storyGlobals = { ...meta.globals, ...spec.globals };
    const component = meta.component;
    const renderFn: CsfRender | undefined =
      spec.render ?? meta.render ?? (component ? (a) => createElement(component, a) : undefined);

    const csfContext = (config: unknown, globals: Globals, local: Args = {}): CsfContext => ({
      args: withoutUndefined({ ...args, ...(config as Args), ...local }),
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
        build: ({ local, setLocal }: LocalArgs): [ArgsScope, CsfContext] => {
          const context = csfContext(ctx.config, ctx.globals, local);
          const scope: ArgsScope = {
            args: context.args,
            configArgs: withoutUndefined({ ...args, ...(ctx.config as Args) }),
            initialArgs: args,
            defaults,
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
