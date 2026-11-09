/**
 * The parts of TypeDoc's JSON output (`typedoc --json`, its `JSONOutput` schema) forge reads, restated so forge
 * reads it with no TypeDoc installed.
 */

/** TypeDoc's `ReflectionKind` values. */
export const Kind = {
  Module: 2,
  Namespace: 4,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Method: 2048,
  TypeAlias: 2097152,
} as const;

/** An inline tag's target: a reflection's id, a URL, or a name TypeDoc could not resolve. */
export type TdTarget = number | string | { packageName?: string; qualifiedName?: string };

export interface TdPart {
  kind: string;
  text: string;
  tag?: string;
  target?: TdTarget;
}

export interface TdComment {
  summary?: TdPart[];
  blockTags?: { tag: string; name?: string; content: TdPart[] }[];
}

export interface TdType {
  type: string;
  name?: string;
  value?: unknown;
  /** A reference's: a reflection's id in this project, else a description of a declaration outside it. */
  target?: unknown;
  typeArguments?: TdType[];
  types?: TdType[];
  elementType?: TdType;
  elements?: TdType[];
  element?: TdType;
  isOptional?: boolean;
  declaration?: TdReflection;
  queryType?: TdType;
  operator?: string;
  objectType?: TdType;
  indexType?: TdType;
  checkType?: TdType;
  extendsType?: TdType;
  trueType?: TdType;
  falseType?: TdType;
  head?: string;
  tail?: [TdType, string][];
  asserts?: boolean;
  targetType?: TdType;
  parameter?: string;
  parameterType?: TdType;
  templateType?: TdType;
}

export interface TdReflection {
  id: number;
  name: string;
  variant?: string;
  kind: number;
  flags?: { isOptional?: boolean; isReadonly?: boolean; isRest?: boolean };
  comment?: TdComment;
  sources?: { fileName: string }[];
  children?: TdReflection[];
  signatures?: TdReflection[];
  parameters?: TdReflection[];
  typeParameters?: TdReflection[];
  type?: TdType;
  inheritedFrom?: TdType;
}

/** Where an export is: the names of the modules it is in, outermost first, and its own name. */
export interface TypedocTarget {
  modules: string[];
  name: string;
}

/** The page documenting an export, or undefined for one with none. */
export type TypedocHref = (target: TypedocTarget) => string | undefined;

/** A project's reflections by id, and the export each one is declared in. */
export interface TdIndex {
  byId: Map<number, TdReflection>;
  exportOf: Map<number, TypedocTarget>;
  /** The exports themselves, which are what a component is looked up among. */
  exports: TdReflection[];
}

export function indexProject(project: TdReflection): TdIndex {
  const index: TdIndex = { byId: new Map(), exportOf: new Map(), exports: [] };
  const walk = (container: TdReflection, modules: string[], prefix: string) => {
    for (const child of container.children ?? []) {
      if (child.kind === Kind.Module) {
        walk(child, [...modules, child.name], '');
        continue;
      }
      const name = prefix + child.name;
      if (child.kind === Kind.Namespace) {
        walk(child, modules, `${name}.`);
        continue;
      }
      if (child.variant === 'reference') continue;
      index.exports.push(child);
      const target = { modules, name };
      for (const nested of reflectionsUnder(child)) {
        index.byId.set(nested.id, nested);
        index.exportOf.set(nested.id, target);
      }
    }
  };
  walk(project, [], '');
  return index;
}

/** A reflection and every reflection declared inside it: members, signatures, parameters and inline types. */
function reflectionsUnder(value: unknown, found: TdReflection[] = []): TdReflection[] {
  if (Array.isArray(value)) {
    for (const item of value) reflectionsUnder(item, found);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'number' && typeof record.variant === 'string') found.push(record as unknown as TdReflection);
    for (const key of Object.keys(record)) {
      // A type's `target` names some other reflection; only what is nested here belongs to this one.
      if (key !== 'target') reflectionsUnder(record[key], found);
    }
  }
  return found;
}
