// A library's tunable parameters as plain JSON: no functions, no classes, nothing a lab or
// a store has to be installed to read. labkit's `f.params` compiles one into a config schema.

import { setOwn } from '@weasel-js/registry';

/** What every param says about itself besides its kind. */
interface ParamBase {
  /** What a control calls it. Unset, a lab titles the key. */
  label?: string;
  /** Longer help, read under or beside the control. */
  description?: string;
  /** May be auto, computed by its owner rather than set. `on` starts it auto. As `PrefAuto`, minus its value. */
  auto?: { on?: boolean };
}

/** A number. Bounded on both sides, a lab draws it as a slider. */
export interface ParamNumber extends ParamBase {
  kind: 'number';
  /** Unset, the `min`, else 0. */
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  /** The unit shown after the value: `'°'`, `'ms'`. Presentation only. */
  suffix?: string;
}

/** On or off. */
export interface ParamBoolean extends ParamBase {
  kind: 'boolean';
  /** Unset, `false`. */
  default?: boolean;
}

/** One labeled choice of a {@link ParamEnum}. */
export interface ParamEnumOption<V extends string = string> {
  value: V;
  label: string;
}

/** One of a fixed set of choices, each a bare value or a `{ value, label }`. */
export interface ParamEnum<V extends string = string> extends ParamBase {
  kind: 'enum';
  options: readonly (V | ParamEnumOption<V>)[];
  /** Unset, the first option. */
  default?: V;
}

/** A color as a hex string, `#rrggbb`, or `#rrggbbaa` with `alpha`. */
export interface ParamColor extends ParamBase {
  kind: 'color';
  /** Unset, `#000000`. */
  default?: string;
  alpha?: boolean;
}

/** One param. */
export type ParamSpec = ParamNumber | ParamBoolean | ParamEnum | ParamColor;

/** Params nested under one key, so each is read at `group.key`. */
export interface ParamGroup<S extends ParamShape = ParamShape> {
  kind: 'group';
  label?: string;
  description?: string;
  params: S;
}

/** Either a param or a group of them. */
export type ParamEntry = ParamSpec | ParamGroup;

/** Params and groups by key, in the order a lab lists them. */
export type ParamShape = { readonly [key: string]: ParamEntry };

type OptionValue<O> = O extends string ? O : O extends { value: infer V } ? V : never;

/** The value one entry holds. */
export type ParamValue<E> = E extends { kind: 'group'; params: infer S }
  ? ParamValues<S>
  : E extends { kind: 'number' }
    ? number
    : E extends { kind: 'boolean' }
      ? boolean
      : E extends { kind: 'enum'; options: readonly (infer O)[] }
        ? OptionValue<O>
        : E extends { kind: 'color' }
          ? string
          : never;

/** The values a shape holds, nested the way its groups are. */
export type ParamValues<S> = { -readonly [K in keyof S]: ParamValue<S[K]> };

function optionValue(option: string | ParamEnumOption): string {
  return typeof option === 'string' ? option : option.value;
}

/** A param's own default, or the one its kind falls back to. */
export function paramDefault(spec: ParamSpec): number | boolean | string {
  switch (spec.kind) {
    case 'number':
      return spec.default ?? spec.min ?? 0;
    case 'boolean':
      return spec.default ?? false;
    case 'enum': {
      const values = spec.options.map(optionValue);
      if (values.length === 0) throw new Error('prefs-schema: an enum param needs at least one option.');
      const def = spec.default ?? (values[0] as string);
      if (!values.includes(def)) {
        throw new Error(`prefs-schema: enum default ${JSON.stringify(def)} is not one of its options.`);
      }
      return def;
    }
    case 'color':
      return spec.default ?? '#000000';
    default:
      throw new Error(`prefs-schema: unknown param kind ${JSON.stringify((spec as { kind: unknown }).kind)}.`);
  }
}

function given(values: unknown, key: string): unknown {
  return values !== null && typeof values === 'object' && Object.hasOwn(values, key)
    ? (values as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Every value a shape starts at, nested the way its groups are. A value in `defaults` stands in for
 * a param's own `default`, for a library that keeps its defaults apart from its descriptions; one of
 * the wrong type, or an enum value that is not one of its options, throws.
 */
export function paramDefaults<const S extends ParamShape>(shape: S, defaults?: unknown): ParamValues<S> {
  return defaultsIn(shape, defaults, '') as ParamValues<S>;
}

function defaultsIn(shape: ParamShape, defaults: unknown, at: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(shape)) {
    const path = at === '' ? key : `${at}.${key}`;
    const value = given(defaults, key);
    if (entry.kind === 'group') {
      setOwn(out, key, defaultsIn(entry.params, value, path));
      continue;
    }
    const own = paramDefault(entry);
    if (value === undefined) {
      setOwn(out, key, own);
    } else if (typeof value !== typeof own) {
      throw new Error(
        `prefs-schema: the default given for ${path} is ${JSON.stringify(value)}, not a ${typeof own}.`,
      );
    } else {
      setOwn(out, key, entry.kind === 'enum' ? paramDefault({ ...entry, default: value as string }) : value);
    }
  }
  return out;
}
