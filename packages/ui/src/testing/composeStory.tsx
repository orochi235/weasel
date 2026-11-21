import { createElement, useState, type ComponentType, type ReactNode } from 'react';

// A story module's stories as components a test can render outside forge: a CSF story on its args, a native one on
// its config's defaults. What only forge's frame provides (`useArgs`, a timeline's playhead) is not here.

type Ctx = Record<string, unknown>;
type CsfRender = (args: Ctx, ctx: Ctx) => ReactNode;
type CsfDecorator = (Story: ComponentType, ctx: Ctx) => ReactNode;
interface Csf {
  name?: string;
  storyName?: string;
  title?: string;
  args?: Ctx;
  parameters?: Ctx;
  globals?: Ctx;
  includeStories?: string[] | RegExp;
  excludeStories?: string[] | RegExp;
  render?: CsfRender;
  decorators?: CsfDecorator | CsfDecorator[];
  component?: ComponentType<Ctx>;
}
type NativeDecorator = (story: () => ReactNode, ctx: Ctx) => ReactNode;
interface Native {
  name?: string;
  config?: { defaults(): unknown };
  initialState?: (config: unknown) => unknown;
  render: (ctx: Ctx) => ReactNode;
  decorators?: NativeDecorator[];
}

const NATIVE = Symbol.for('weaselforge.native');
const isNative = (value: unknown, kind: 'meta' | 'story'): boolean =>
  !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[NATIVE] === kind;
const matches = (key: string, filter: string[] | RegExp) =>
  Array.isArray(filter) ? filter.includes(key) : key.match(filter) !== null;
const isPlain = (v: unknown): v is Ctx => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/** Storybook's `combineParameters`: plain objects merge deeply, anything else is replaced. */
function combine(...sources: (Ctx | undefined)[]): Ctx {
  const out: Ctx = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      out[key] = isPlain(value) && isPlain(out[key]) ? combine(out[key], value) : value;
    }
  }
  return out;
}

/** forge's `storyNameFromExport`: `primaryButton_2` reads "Primary Button 2". */
const storyName = (exportName: string): string =>
  exportName
    .replace(/[_.-]/g, ' ')
    .replace(/([^\n])([A-Z])([a-z])/g, '$1 $2$3')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z])([0-9])/gi, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2')
    .replace(/(\s|^)(\w)/g, (_, a: string, b: string) => `${a}${b.toUpperCase()}`)
    .replace(/ +/g, ' ')
    .trim();

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** A CSF story as forge draws it: its render (or the meta's component) inside its decorators, then the meta's. */
function csf(meta: Csf, spec: Csf, exportName: string): ComponentType | null {
  const args = { ...meta.args, ...spec.args };
  const name = spec.name || spec.storyName || storyName(exportName);
  const globals = { ...meta.globals, ...spec.globals };
  const parameters = combine(meta.parameters, spec.parameters);
  const ctx = { args, globals, parameters, title: meta.title ?? '', name, id: exportName, viewMode: 'story' };
  const component = meta.component;
  const draw = spec.render ?? meta.render ?? (component ? (a: Ctx) => createElement(component, a) : null);
  if (!draw) return null;
  let inner: ComponentType = () => draw(args, ctx);
  for (const decorate of [...asArray(spec.decorators), ...asArray(meta.decorators)]) {
    const wrapped = inner;
    inner = (): ReactNode => decorate(wrapped, ctx);
  }
  return inner;
}

/** A native story on its config's defaults, holding its state as a trial would. */
function native(meta: { title?: string; decorators?: NativeDecorator[] }, spec: Native, exportName: string): ComponentType {
  const name = spec.name || storyName(exportName);
  const title = meta.title ?? '';
  const config = spec.config?.defaults() ?? {};
  return function Trial() {
    const [state, setState] = useState(() => spec.initialState?.(config) ?? null);
    const ctx = { config, setConfig: () => {}, state, setState, globals: {}, title, name };
    let inner: () => ReactNode = () => spec.render(ctx);
    for (const decorate of [...(spec.decorators ?? []), ...(meta.decorators ?? [])]) {
      const wrapped = inner;
      inner = () => decorate(wrapped, ctx);
    }
    return inner();
  };
}

/** Each story `mod` exports, by export name, chosen as forge's loader chooses them. */
export function storiesOf(mod: Record<string, unknown>): [string, ComponentType][] {
  const out: [string, ComponentType][] = [];
  if (isNative(mod.default, 'meta')) {
    const meta = mod.default as { title?: string; decorators?: NativeDecorator[] };
    for (const [name, value] of Object.entries(mod)) {
      if (name !== 'default' && isNative(value, 'story')) out.push([name, native(meta, value as Native, name)]);
    }
    return out;
  }
  const meta = (mod.default ?? {}) as Csf;
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'default' || name.startsWith('__') || !value) continue;
    if (meta.includeStories && !matches(name, meta.includeStories)) continue;
    if (meta.excludeStories && matches(name, meta.excludeStories)) continue;
    if (typeof value !== 'function' && typeof value !== 'object') continue;
    // A CSF 2 function export hoists its annotations onto itself.
    const spec: Csf = typeof value === 'function' ? { ...value, render: value as CsfRender } : (value as Csf);
    const story = csf(meta, spec, name);
    if (story) out.push([name, story]);
  }
  return out;
}
