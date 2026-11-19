import { createElement, useState, type ComponentType, type ReactNode } from 'react';

// A story module's stories as components a test can render outside forge: a CSF story on its args, a native one on
// its config's defaults. What only forge's frame provides (`useArgs`, a timeline's playhead) is not here.

type Ctx = Record<string, unknown>;
type CsfRender = (args: Ctx, ctx: Ctx) => ReactNode;
type CsfDecorator = (Story: ComponentType, ctx: Ctx) => ReactNode;
interface Csf {
  args?: Ctx;
  render?: CsfRender;
  decorators?: CsfDecorator | CsfDecorator[];
  component?: ComponentType<Ctx>;
}
type NativeDecorator = (story: () => ReactNode, ctx: Ctx) => ReactNode;
interface Native {
  config?: { defaults(): unknown };
  initialState?: (config: unknown) => unknown;
  render: (ctx: Ctx) => ReactNode;
  decorators?: NativeDecorator[];
}

const NATIVE = Symbol.for('weaselforge.native');
const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** A CSF story as forge draws it: its render (or the meta's component) inside its decorators, then the meta's. */
function csf(meta: Csf, spec: Csf, name: string): ComponentType | null {
  const args = { ...meta.args, ...spec.args };
  const ctx = { args, globals: {}, parameters: {}, title: '', name, id: name, viewMode: 'story' };
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
function native(meta: { decorators?: NativeDecorator[] }, spec: Native, name: string): ComponentType {
  const config = spec.config?.defaults() ?? {};
  return function Trial() {
    const [state, setState] = useState(() => spec.initialState?.(config) ?? null);
    const ctx = { config, setConfig: () => {}, state, setState, globals: {}, title: '', name };
    let inner: () => ReactNode = () => spec.render(ctx);
    for (const decorate of [...(spec.decorators ?? []), ...(meta.decorators ?? [])]) {
      const wrapped = inner;
      inner = () => decorate(wrapped, ctx);
    }
    return inner();
  };
}

/** Each story `mod` exports, by export name. */
export function storiesOf(mod: Record<string, unknown>): [string, ComponentType][] {
  const meta = (mod.default ?? {}) as Csf & { decorators?: never };
  const out: [string, ComponentType][] = [];
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'default' || name.startsWith('__') || !value) continue;
    if (typeof value === 'function') {
      const story = csf(meta, { render: value as CsfRender }, name);
      if (story) out.push([name, story]);
    } else if (typeof value === 'object') {
      const story = (value as Record<symbol, unknown>)[NATIVE] === 'story' ? native(meta, value as Native, name) : csf(meta, value as Csf, name);
      if (story) out.push([name, story]);
    }
  }
  return out;
}
