import { type ConfigNode, type ConfigSchema, type ConfigShape, f } from '@weasel-js/labkit/config';
import { isValidElement } from 'react';

/** A CSF `argTypes` entry, as far as forge reads it. */
export interface ArgType {
  name?: string;
  description?: string;
  control?: string | false | { type?: string; min?: number; max?: number; step?: number };
  options?: readonly unknown[];
  table?: { disable?: boolean };
}

interface Leaf extends ConfigNode<unknown> {
  hidden(): Leaf;
  describe(description: string): Leaf;
  label(name: string): Leaf;
}

interface Control {
  type: string | undefined;
  min?: number;
  max?: number;
  step?: number;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

/** Functions and React elements reach `render` in `args` but never become controls. */
export const isControllable = (value: unknown): boolean => typeof value !== 'function' && !isValidElement(value);

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
  const pick = <T>(zero: T, test: (v: unknown) => boolean): T => (has && test(value) ? (value as T) : zero);
  switch (control.type) {
    case 'number': {
      const node = bounded(f.number(pick(0, (v) => typeof v === 'number')), control);
      return control.min !== undefined && control.max !== undefined ? node.input() : node;
    }
    case 'range':
    case 'slider':
      return bounded(f.number(pick(0, (v) => typeof v === 'number')), control).slider();
    case 'boolean':
      return f.boolean(pick(false, (v) => typeof v === 'boolean'));
    case 'switch':
      return f.boolean(pick(false, (v) => typeof v === 'boolean')).toggle();
    case 'text':
    case 'textarea':
      return f.string(pick('', (v) => typeof v === 'string'));
    case 'select':
    case 'radio':
    case 'inline-radio':
    case undefined: {
      if (!options) return control.type === undefined && has ? inferred(value) : null;
      const node = f.enum(pick(options[0] as string, (v) => typeof v === 'string'), options);
      return control.type === 'radio' || control.type === 'inline-radio' ? node.radio() : node;
    }
    case 'object':
      return f.custom('json', has ? value : null);
    default:
      return has ? inferred(value) : null;
  }
}

/** A labkit schema for a CSF story's args, refined by its `argTypes`. */
export function argsToSchema(
  args: Readonly<Record<string, unknown>>,
  argTypes: Readonly<Record<string, ArgType | undefined>>,
): ConfigSchema<unknown> {
  const nodes: Record<string, Leaf> = {};
  for (const key of new Set([...Object.keys(args), ...Object.keys(argTypes)])) {
    const has = key in args;
    const value = args[key];
    if (has && !isControllable(value)) continue;
    const argType = argTypes[key];
    const control = argType ? controlOf(argType) : false;

    let node: Leaf | null = control ? controlled(control, argType ?? {}, has, value) : has ? inferred(value) : null;
    if (!node) continue;
    if (argType && (argType.control === false || argType.table?.disable)) node = node.hidden();
    if (argType?.description) node = node.describe(argType.description);
    if (argType?.name) node = node.label(argType.name);
    nodes[key] = node;
  }
  return f.schema(nodes as ConfigShape);
}
