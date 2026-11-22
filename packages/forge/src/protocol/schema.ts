import {
  f,
  isConfigBranch,
  isConfigNodeShown,
  resolveConfigSchema,
  type Annotations,
  type BranchAnnotations,
  type ConfigActionContext,
  type ConfigActionRun,
  type ConfigBranch,
  type ConfigEntry,
  type ConfigNode,
  type ConfigSchema,
  type ConfigShape,
  type NodeOptions,
} from '@weasel-js/labkit/config';
import { isPlainObject } from '@weasel-js/core';
import { setOwn } from '@weasel-js/registry';
import { isPortSafe, portSafePart } from '../csf/portSafe';

/** The section a described entry sits in, as structured-clone data. */
export interface SectionDescription {
  label: string;
  collapsed?: boolean;
}

/** One key of a described shape: a leaf, or a branch holding more. */
export type DescribedEntry =
  | {
      branch: true;
      annotations: BranchAnnotations;
      section?: SectionDescription;
      conditional: boolean;
      /** The node has an `.enableIf` written as code, which the frame answers. */
      gated?: true;
      /** The group's heading carries a reset. */
      resettable?: true;
      children: DescribedShape;
    }
  | {
      branch: false;
      kind: string | null;
      default: unknown;
      annotations: Annotations;
      section?: SectionDescription;
      conditional: boolean;
      /** The node has an `.enableIf` written as code, which the frame answers. */
      gated?: true;
      validated: boolean;
      /** The node draws its own row with `.render`, which stays in the frame. */
      customControl: boolean;
      /** An action whose `run` stays in the frame: the rebuilt leaf's button asks the frame to run it. */
      runsInFrame?: true;
      /** The leaf may be auto (`.auto()`), as data. */
      auto?: NodeOptions['auto'];
      /** The auto row reads out its value (`.quote()`). */
      autoQuote?: true;
      /** The leaf computes its value while auto with an `autoResolve`, which the frame answers. */
      resolves?: true;
    };

/** A config shape as structured-clone data: each key's entry, described. */
export type DescribedShape = { [key: string]: DescribedEntry };

/** A story's `f.schema` as structured-clone data. */
export interface SchemaDescription {
  nodes: DescribedShape;
}

/** Answers the workshop has for the rebuilt schema's predicates. */
export interface SchemaAnswers {
  hidden(path: string, config: unknown): boolean;
  errors(path: string, config: unknown): string[];
  /** Whether the frame answered that the node at `path`'s own `.enableIf` does not hold. Absent, none is disabled. */
  disabled?(path: string, config: unknown): boolean;
  /** What the frame answered the auto leaf at `path` computes under `config`. Absent, an auto leaf computes nothing. */
  resolved?(path: string, config: unknown): unknown;
  /** Asks the frame of the panel that pressed it, which `ctx` names, to run its action at `path`. Without it, the
   *  rebuilt action's button does nothing. */
  run?(path: string, ctx: ConfigActionContext): void;
}

/** A node's path in answers: keys joined by `.`, with a `.` or `\\` inside a key escaped, so a key holding a dot
 *  never reads as the nested path it looks like. */
const joinPath = (at: string, key: string): string => {
  const escaped = key.replace(/[\\.]/g, '\\$&');
  return at === '' ? escaped : `${at}.${escaped}`;
};

/** The keys a {@link joinPath} path names. */
function pathKeys(path: string): string[] {
  const keys = [''];
  for (let i = 0; i < path.length; i++) {
    const c = path[i]!;
    if (c === '\\' && i + 1 < path.length) keys[keys.length - 1] += path[++i]!;
    else if (c === '.') keys.push('');
    else keys[keys.length - 1] += c;
  }
  return keys;
}

type ResolvedGroup = ReturnType<typeof resolveConfigSchema>['group'];

const DROPPED = Symbol('dropped');

/**
 * `value` as structured-clone data: a function is left out, and so is any other object holding one, which is code (a
 * scale's pair, a function unit, a motif) rather than data. An object carrying a `kind` or `members` is a nested leaf
 * or section, and like the bag at the top (`keepsKeys`) loses only its function-valued keys; a nested leaf's
 * `encoding` stays as `null`, so a URL reader still knows the leaf stores something other than its kind. Any other
 * object a port would not deliver as itself, a class instance or a Map holding a function, is left out too.
 */
function dataOf(value: unknown, keepsKeys = false): unknown {
  if (typeof value === 'function' || typeof value === 'symbol') return DROPPED;
  if (Array.isArray(value)) return value.map((member) => dataOf(member)).filter((member) => member !== DROPPED);
  if (!isPlainObject(value)) return value === null || typeof value !== 'object' || isPortSafe(value) ? value : DROPPED;
  const described = keepsKeys || typeof value.kind === 'string' || 'members' in value;
  if (!described && Object.values(value).some((member) => typeof member === 'function')) return DROPPED;
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    const data = dataOf(member);
    if (data !== DROPPED) setOwn(out, key, data);
    else if (key === 'encoding' && typeof value.kind === 'string') setOwn(out, key, null);
  }
  return out;
}

/** A leaf's auto options as data: `auto` and `autoQuote` as they are, and an `autoResolve` as a flag the frame answers. */
function autoOf(options: NodeOptions): Pick<Extract<DescribedEntry, { branch: false }>, 'auto' | 'autoQuote' | 'resolves'> {
  const auto = options.auto === undefined ? undefined : dataOf(options.auto, true);
  return {
    ...(auto === undefined || auto === DROPPED ? {} : { auto: auto as NodeOptions['auto'] }),
    ...(options.autoQuote ? { autoQuote: true as const } : {}),
    ...(options.autoResolve ? { resolves: true as const } : {}),
  };
}

function describeShape(shape: ConfigShape): DescribedShape {
  const out: DescribedShape = {};
  for (const [key, entry] of Object.entries(shape)) {
    const { section, showIf, enableIf } = entry.options;
    const sectionData = section === undefined ? undefined : dataOf(section, true);
    const common = {
      annotations: dataOf(entry.annotations, true) as Annotations,
      ...(sectionData === undefined ? {} : { section: sectionData as SectionDescription }),
      conditional: showIf !== undefined,
      ...(enableIf === undefined ? {} : { gated: true as const }),
    };
    const described: DescribedEntry = isConfigBranch(entry)
      ? {
          branch: true,
          ...common,
          ...(entry.options.resettable ? { resettable: true as const } : {}),
          children: describeShape(entry.children),
        }
      : {
          branch: false,
          kind: entry.kind,
          // The part a port delivers, so `ready` posts, and the workshop's default is the value the frame can be sent.
          default: portSafePart(entry.default)?.value,
          ...common,
          validated: entry.options.validate !== undefined,
          customControl: entry.options.render !== undefined,
          ...(typeof entry.annotations.run === 'function' ? { runsInFrame: true as const } : {}),
          ...autoOf(entry.options),
        };
    setOwn(out, key, described);
  }
  return out;
}

export function describeSchema(schema: ConfigSchema<unknown>): SchemaDescription {
  return { nodes: describeShape(schema.nodes) };
}

function rebuildShape(shape: DescribedShape, at: string, answers: SchemaAnswers): ConfigShape {
  const out: Record<string, ConfigEntry> = {};
  for (const [key, entry] of Object.entries(shape)) {
    const path = joinPath(at, key);
    const options: NodeOptions = {
      ...(entry.section === undefined ? {} : { section: entry.section }),
      ...(entry.conditional ? { showIf: (config) => !answers.hidden(path, config) } : {}),
      ...(entry.gated ? { enableIf: (config) => !(answers.disabled?.(path, config) ?? false) } : {}),
    };
    if (entry.branch) {
      const branch: ConfigBranch = {
        children: rebuildShape(entry.children, path, answers),
        annotations: entry.annotations,
        options: entry.resettable ? { ...options, resettable: true } : options,
      };
      setOwn(out, key, branch);
    } else {
      const leafOptions: NodeOptions = {
        ...options,
        ...(entry.validated ? { validate: (_leaf, config) => answers.errors(path, config) } : {}),
        ...(entry.auto === undefined ? {} : { auto: entry.auto }),
        ...(entry.autoQuote ? { autoQuote: true } : {}),
        ...(entry.resolves ? { autoResolve: (config) => answers.resolved?.(path, config) } : {}),
      };
      const node: ConfigNode = {
        kind: entry.kind,
        default: entry.default,
        annotations: entry.runsInFrame ? { ...entry.annotations, run: (ctx: ConfigActionContext) => answers.run?.(path, ctx) } : entry.annotations,
        options: leafOptions,
      };
      setOwn(out, key, node);
    }
  }
  return out;
}

export function schemaFromDescription(
  description: SchemaDescription,
  answers: SchemaAnswers,
): ConfigSchema<unknown> {
  return f.schema(rebuildShape(description.nodes, '', answers)) as ConfigSchema<unknown>;
}

/** The `run` of the action leaf at `path` in `schema`, or undefined where none is. */
export function schemaActionAt(schema: ConfigSchema<unknown>, path: string): ConfigActionRun | undefined {
  let shape: ConfigShape = schema.nodes;
  const segments = pathKeys(path);
  for (const [i, segment] of segments.entries()) {
    if (!Object.hasOwn(shape, segment)) return undefined;
    const entry = shape[segment]!;
    if (isConfigBranch(entry)) shape = entry.children;
    else return i === segments.length - 1 && typeof entry.annotations.run === 'function' ? entry.annotations.run : undefined;
  }
  return undefined;
}

/** Evaluate a schema's own predicates for one config — the frame's half of `answers`. */
export function answerSchema(
  schema: ConfigSchema<unknown>,
  config: unknown,
): { hidden: string[]; errors: Record<string, string[]>; disabled: string[]; resolved: Record<string, unknown> } {
  const hidden: string[] = [];
  const resolved: Record<string, unknown> = {};
  const disabled: string[] = [];
  const errors: Record<string, string[]> = {};
  const record = config as Record<string, unknown>;
  const { group, over } = resolveConfigSchema(schema);

  const walk = (shape: ConfigShape, at: string, node: ResolvedGroup): void => {
    for (const [key, entry] of Object.entries(shape)) {
      const path = joinPath(at, key);
      const child = Object.hasOwn(node.children, key) ? node.children[key] : undefined;
      if (!isConfigNodeShown(entry, record, group, over)) hidden.push(path);
      if (entry.options.enableIf && !entry.options.enableIf(record)) disabled.push(path);
      if (isConfigBranch(entry)) {
        if (child && 'children' in child) walk(entry.children, path, child);
        continue;
      }
      const { validate, autoResolve } = entry.options;
      if (autoResolve) {
        const value = autoResolve(record);
        if (isPortSafe(value)) setOwn(resolved, path, value);
      }
      if (!validate) continue;
      if (!child || 'children' in child || 'members' in child) continue;
      const leaf = child;
      const found = validate(leaf, record);
      if (found.length > 0) setOwn(errors, path, found);
    }
  };
  walk(schema.nodes, '', group);
  return { hidden, errors, disabled, resolved };
}
