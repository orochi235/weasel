import { type ConfigNode, type ConfigSchema, type ConfigShape, f } from '@weasel-js/labkit/config';
import { isPlainObject } from './isPlainObject';
import { portSafePart } from './portSafe';

/** Storybook's conditional control: shown only while an arg, or a global, meets the test. */
export type ArgCondition = ({ arg: string } | { global: string }) & {
  truthy?: boolean;
  exists?: boolean;
  eq?: unknown;
  neq?: unknown;
};

/** A CSF `argTypes` entry, as far as forge reads it. */
export interface ArgType {
  name?: string;
  description?: string;
  control?: string | false | { type?: string; min?: number; max?: number; step?: number };
  options?: readonly unknown[];
  table?: { disable?: boolean };
  if?: ArgCondition;
}

interface Leaf extends ConfigNode<unknown> {
  hidden(): Leaf;
  describe(description: string): Leaf;
  label(name: string): Leaf;
  showIf(predicate: (config: Record<string, unknown>) => boolean): Leaf;
}

interface Control {
  type: string | undefined;
  min?: number;
  max?: number;
  step?: number;
}

function controlOf(argType: ArgType): Control | false {
  const { control } = argType;
  if (control === false) return false;
  if (typeof control === 'string') return { type: control };
  return { type: control?.type, min: control?.min, max: control?.max, step: control?.step };
}

function stringOptions(argType: ArgType): string[] | null {
  const opts = argType.options;
  return opts && opts.length > 0 && opts.every((o) => typeof o === 'string') ? (opts as string[]) : null;
}

function inferred(value: unknown): Leaf | null {
  switch (typeof value) {
    case 'number':
      return f.number(value);
    case 'boolean':
      return f.boolean(value);
    case 'string':
      return f.string(value);
    default:
      return Array.isArray(value) || isPlainObject(value) ? f.custom('json', value) : null;
  }
}

function bounded(node: ReturnType<typeof f.number>, control: Control) {
  let out = node;
  if (control.min !== undefined && control.max !== undefined) out = out.range(control.min, control.max);
  if (control.step !== undefined) out = out.step(control.step);
  return out;
}

function controlled(control: Control, argType: ArgType, has: boolean, value: unknown): Leaf | null {
  const options = stringOptions(argType);
  // Storybook passes an argTypes-only key as undefined, so the component's own default applies.
  const def = <T>() => (has ? value : undefined) as T;
  switch (control.type) {
    case 'number': {
      const node = bounded(f.number(def()), control);
      return control.min !== undefined && control.max !== undefined ? node.input() : node;
    }
    case 'range':
    case 'slider':
      return has ? bounded(f.number(def()), control).slider() : null;
    case 'boolean':
      return f.boolean(def());
    case 'switch':
      return f.boolean(def()).toggle();
    case 'text':
    case 'textarea':
      return f.string(def());
    case 'select':
    case 'radio':
    case 'inline-radio':
    case undefined: {
      if (!options) return control.type === undefined && has ? inferred(value) : null;
      const node = f.enum(def<string>(), options);
      return control.type === 'radio' || control.type === 'inline-radio' ? node.radio() : node;
    }
    case 'object':
      return has ? f.custom('json', value) : null;
    default:
      return has ? inferred(value) : null;
  }
}

/** The config predicate for an `if`; null for a condition on a global, which a story's config does not hold. */
function conditionOf(condition: ArgCondition): ((config: Record<string, unknown>) => boolean) | null {
  if (!('arg' in condition)) return null;
  const { arg } = condition;
  return (config) => {
    const value = config[arg];
    if (condition.exists !== undefined) return (value !== undefined) === condition.exists;
    if ('eq' in condition) return Object.is(value, condition.eq);
    if ('neq' in condition) return !Object.is(value, condition.neq);
    return Boolean(value) === (condition.truthy ?? true);
  };
}

/** `parameters.controls.matchers`: arg names that pick a control when the arg's argType names none. */
export interface ControlMatchers {
  color?: RegExp;
  /** labkit has no date leaf, so a date match keeps the leaf its value infers. */
  date?: RegExp;
}

/** Storybook's rule: a string arg with no control or options whose name matches `color` gets a color picker. */
function matched(key: string, value: unknown, argType: ArgType | undefined, matchers: ControlMatchers): Leaf | null {
  if (typeof value !== 'string' || argType?.control !== undefined || stringOptions(argType ?? {})) return null;
  return matchers.color?.test(key) ? f.color(value) : null;
}

/** A labkit schema for a CSF story's args, refined by its `argTypes`. */
export function argsToSchema(
  args: Readonly<Record<string, unknown>>,
  argTypes: Readonly<Record<string, ArgType | undefined>>,
  matchers: ControlMatchers = {},
): ConfigSchema<unknown> {
  const nodes: Record<string, Leaf> = {};
  for (const key of new Set([...Object.keys(args), ...Object.keys(argTypes)])) {
    const has = key in args;
    // A control carries only what crosses the port; the frame puts the rest back from `args` (`withUnsent`).
    const part = has ? portSafePart(args[key]) : null;
    if (has && !part) continue;
    const value = part?.value;
    const argType = argTypes[key];
    const control = argType ? controlOf(argType) : false;

    let node: Leaf | null =
      (has ? matched(key, value, argType, matchers) : null) ??
      (control ? controlled(control, argType ?? {}, has, value) : has ? inferred(value) : null);
    if (!node) continue;
    if (argType && (argType.control === false || argType.table?.disable)) node = node.hidden();
    if (argType?.description) node = node.describe(argType.description);
    if (argType?.name) node = node.label(argType.name);
    const shownWhen = argType?.if ? conditionOf(argType.if) : null;
    if (shownWhen) node = node.showIf(shownWhen);
    nodes[key] = node;
  }
  return f.schema(nodes as ConfigShape);
}
