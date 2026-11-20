import { type ConfigNode, type ConfigSchema, type ConfigShape, f, ObjectNode, UnionNode } from '@weasel-js/labkit/config';
import { isPlainObject } from '@weasel-js/core';
import { iconFromData } from '@weasel-js/ui/components/Icon';
import { sameKnob } from '../route/url';
import { getOwn, setOwn } from '@weasel-js/registry';
import { portSafePart } from './portSafe';

/** Storybook's conditional control: shown only while an arg, or a global, meets the test. */
export type ArgCondition = ({ arg: string } | { global: string }) & {
  truthy?: boolean;
  exists?: boolean;
  eq?: unknown;
  neq?: unknown;
};

/**
 * Storybook's `SBType`, as far as forge reads it: the shape of an arg's value. A control is built from the parts of
 * an array, an object or a union, and a union of objects that each pin one field to a string is edited as a choice
 * of that string, with the chosen object's own fields under it.
 */
export type ArgShape =
  | { name: 'boolean' | 'string' | 'number' }
  | { name: 'enum'; value: readonly string[] }
  | { name: 'array'; value: ArgShape }
  | { name: 'object'; value: Readonly<Record<string, ArgShape>> }
  | { name: 'union'; value: readonly ArgShape[] };

/** A CSF `argTypes` entry, as far as forge reads it. */
export interface ArgType {
  name?: string;
  description?: string;
  type?: ArgShape;
  control?:
    | string
    | false
    | {
        type?: string;
        min?: number;
        max?: number;
        step?: number;
        /** forge's own: a qualified icon ref (`ui:variantSolid`) per option, drawn in place of its label. */
        icons?: Readonly<Record<string, string>>;
      };
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
  icons?: Readonly<Record<string, string>>;
}

function controlOf(argType: ArgType): Control | false {
  const { control } = argType;
  if (control === false) return false;
  if (typeof control === 'string') return { type: control };
  return { type: control?.type, min: control?.min, max: control?.max, step: control?.step, icons: control?.icons };
}

/** A choice control's options, as the strings an enum holds, with the values they stand for. */
export interface OptionChoice {
  labels: readonly string[];
  values: readonly unknown[];
}

const CHOICE_CONTROLS: ReadonlySet<string | undefined> = new Set(['select', 'radio', 'inline-radio', undefined]);

const hasStringForm = (o: unknown): boolean =>
  o === null || o === undefined || ['string', 'number', 'boolean', 'bigint'].includes(typeof o);

/** `argType`'s options as a choice, each read as `String(option)`; null for none, or for options that have no string
 *  form or read alike, which no enum can tell apart. */
function optionChoice(argType: ArgType): OptionChoice | null {
  const opts = argType.options;
  if (!opts || opts.length === 0 || !opts.every(hasStringForm)) return null;
  const labels = opts.map(String);
  return new Set(labels).size === labels.length ? { labels, values: opts } : null;
}

/** The choice each key's control offers, for every key whose argType draws its options as one. */
export function argChoices(argTypes: Readonly<Record<string, ArgType | undefined>>): Record<string, OptionChoice> {
  const out: Record<string, OptionChoice> = {};
  for (const [key, argType] of Object.entries(argTypes)) {
    const control = argType ? controlOf(argType) : false;
    const choice = control && CHOICE_CONTROLS.has(control.type) ? optionChoice(argType!) : null;
    if (choice) setOwn(out, key, choice);
  }
  return out;
}

/** The option a choice's config value stands for; any other value as it is. */
export function choiceValue(choice: OptionChoice | undefined, value: unknown): unknown {
  const at = choice && typeof value === 'string' ? choice.labels.indexOf(value) : -1;
  return at === -1 ? value : choice!.values[at];
}

/** The config value standing for an option of a choice; any other value as it is. */
export function choiceLabel(choice: OptionChoice | undefined, value: unknown): unknown {
  const at = choice ? choice.values.findIndex((v) => Object.is(v, value)) : -1;
  return at === -1 ? value : choice!.labels[at];
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

type ObjectShape = Extract<ArgShape, { name: 'object' }>;

/**
 * A union's members by the string each pins one field to, with that field: the first field every member pins.
 * Members pinning the same string are one variant, holding the fields of each.
 */
function variantsOf(members: readonly ArgShape[]): { tag: string; variants: Map<string, ObjectShape> } | null {
  const objects = members.filter((m): m is ObjectShape => m.name === 'object');
  if (objects.length !== members.length || objects.length === 0) return null;
  const pinned = (m: ObjectShape, key: string) => {
    const field = getOwn(m.value, key);
    return field?.name === 'enum' && field.value.length === 1 ? field.value[0] : undefined;
  };
  const tag = Object.keys(objects[0]!.value).find((key) => objects.every((m) => pinned(m, key) !== undefined));
  if (tag === undefined) return null;
  const variants = new Map<string, ObjectShape>();
  for (const member of objects) {
    const name = pinned(member, tag)!;
    const held = variants.get(name)?.value ?? {};
    const added = Object.entries(member.value).filter(([key]) => !Object.hasOwn(held, key));
    variants.set(name, { name: 'object', value: { ...held, ...Object.fromEntries(added) } });
  }
  return { tag, variants };
}

function fieldsOf(shape: ObjectShape, value: unknown, omit?: string): Record<string, Leaf> | null {
  const held = isPlainObject(value) ? value : {};
  const fields: Record<string, Leaf> = {};
  for (const [key, field] of Object.entries(shape.value)) {
    if (key === omit) continue;
    const leaf = shaped(field, getOwn(held, key));
    if (leaf) setOwn(fields, key, leaf);
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

/** A leaf editing a value of `shape`, starting at `value`; null for a shape no control can edit. */
function shaped(shape: ArgShape, value: unknown): Leaf | null {
  switch (shape.name) {
    case 'boolean':
      return f.boolean(value as boolean);
    case 'string':
      return f.string(value as string);
    case 'number':
      return f.number(value as number);
    case 'enum':
      return shape.value.length > 0 ? f.enum(value as string, shape.value) : null;
    case 'array': {
      const item = shaped(shape.value, undefined);
      return item ? (f.list(Array.isArray(value) ? value : [], item) as unknown as Leaf) : null;
    }
    case 'object': {
      const fields = fieldsOf(shape, value);
      if (!fields) return null;
      const node = f.object(fields);
      return new ObjectNode(isPlainObject(value) ? value : node.default, node.annotations, node.options) as unknown as Leaf;
    }
    case 'union': {
      const union = variantsOf(shape.value);
      if (!union) return null;
      const { tag, variants } = union;
      const held = isPlainObject(value) ? getOwn(value, tag) : undefined;
      const nodes = Object.fromEntries(
        [...variants].map(([name, member]) => [name, f.object(fieldsOf(member, held === name ? value : undefined, tag) ?? {})]),
      );
      const node = f.union(tag, nodes);
      const start = typeof held === 'string' && variants.has(held) ? value : node.default;
      return new UnionNode(start, node.annotations, node.options) as unknown as Leaf;
    }
    default:
      return null;
  }
}

/** A leaf for an object-valued arg: from its argType's shape where one is given and editable, else a JSON leaf. */
function structured(argType: ArgType, value: unknown): Leaf | null {
  return (argType.type ? shaped(argType.type, value) : null) ?? inferred(value);
}

/** A bound Storybook draws and labkit holds: finite, or left out. */
const usable = (bound: number | undefined): boolean => bound === undefined || Number.isFinite(bound);

/** The bounds of `control` labkit can hold: each one given finite, in order. Anything else Storybook draws
 *  unbounded, and labkit refuses. */
function boundsOf(control: Control): { min?: number; max?: number } {
  const { min, max } = control;
  if (!usable(min) || !usable(max) || (min !== undefined && max !== undefined && min > max)) return {};
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}

/** Whether `control` gives both bounds, finite and in order. */
const hasRange = (control: Control): boolean => {
  const { min, max } = boundsOf(control);
  return min !== undefined && max !== undefined;
};

/** Warns when `control` names bounds that {@link boundsOf} drops, so a story's author learns why its control is
 *  unbounded. */
function warnUnusableBounds(key: string, control: Control): void {
  if (control.min === undefined && control.max === undefined) return;
  const { min, max } = boundsOf(control);
  if (min !== undefined || max !== undefined) return;
  console.warn(
    `forge: the "${key}" control's bounds (min ${String(control.min)}, max ${String(control.max)}) are not ` +
      'finite and in order, so it is drawn unbounded',
  );
}

function bounded(node: ReturnType<typeof f.number>, control: Control) {
  const { min, max } = boundsOf(control);
  let out = node;
  if (min !== undefined && max !== undefined) out = out.range(min, max);
  else if (min !== undefined) out = out.min(min);
  else if (max !== undefined) out = out.max(max);
  if (control.step !== undefined) out = out.step(control.step);
  return out;
}

function controlled(control: Control, key: string, argType: ArgType, has: boolean, value: unknown): Leaf | null {
  // Storybook passes an argTypes-only key as undefined, so the component's own default applies.
  const def = <T>() => (has ? value : undefined) as T;
  switch (control.type) {
    case 'number': {
      const node = bounded(f.number(def()), control);
      return hasRange(control) ? node.input() : node;
    }
    case 'range':
    case 'slider':
      return has ? bounded(f.number(def()), control).slider() : null;
    case 'boolean':
      return f.boolean(def());
    case 'switch':
      return f.boolean(def()).switch();
    case 'text':
    case 'textarea':
      return f.string(def());
    case 'color':
      return f.color(def());
    case 'select':
    case 'radio':
    case 'inline-radio':
    case undefined: {
      const choice = optionChoice(argType);
      if (!choice) {
        if (argType.options && argType.options.length > 0) {
          console.warn(
            `forge: the "${key}" control's options are not each a string, number, boolean, null or undefined that ` +
              'reads apart from the rest, so it is not drawn as a choice',
          );
        }
        return has ? structured(argType, value) : null;
      }
      const { icons } = control;
      const node = f.enum(
        choiceLabel(choice, def()) as string,
        icons ? choice.labels.map((value) => {
          const ref = iconFromData(getOwn(icons, value));
          return { value, label: value, ...(ref ? { icon: ref } : {}) };
        }) : choice.labels,
      );
      return control.type === 'radio' || control.type === 'inline-radio' ? node.radio() : node;
    }
    case 'object':
      return has ? (argType.type ? shaped(argType.type, value) : null) ?? f.custom('json', value) : null;
    default:
      return has ? inferred(value) : null;
  }
}

/** The config predicate for an `if`; null for a condition on a global, which a story's config does not hold. */
function conditionOf(condition: ArgCondition): ((config: Record<string, unknown>) => boolean) | null {
  if (!('arg' in condition)) return null;
  const { arg } = condition;
  return (config) => {
    const value = getOwn(config, arg);
    if (condition.exists !== undefined) return (value !== undefined) === condition.exists;
    if ('eq' in condition) return sameKnob(value, condition.eq);
    if ('neq' in condition) return !sameKnob(value, condition.neq);
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
  if (typeof value !== 'string' || argType?.control !== undefined || (argType?.options?.length ?? 0) > 0) return null;
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
    const has = Object.hasOwn(args, key);
    // A control carries only what crosses the port; the frame puts the rest back from `args` (`withUnsent`).
    const part = has ? portSafePart(getOwn(args, key)) : null;
    if (has && !part) continue;
    const value = part?.value;
    const argType = getOwn(argTypes, key);
    const control = argType ? controlOf(argType) : false;
    if (control) warnUnusableBounds(key, control);

    let node: Leaf | null =
      (has ? matched(key, value, argType, matchers) : null) ??
      (control ? controlled(control, key, argType ?? {}, has, value) : has ? inferred(value) : null);
    if (!node) continue;
    if (argType && (argType.control === false || argType.table?.disable)) node = node.hidden();
    if (argType?.description) node = node.describe(argType.description);
    if (argType?.name) node = node.label(argType.name);
    const shownWhen = argType?.if ? conditionOf(argType.if) : null;
    if (shownWhen) node = node.showIf(shownWhen);
    setOwn(nodes, key, node);
  }
  return f.schema(nodes as ConfigShape);
}
