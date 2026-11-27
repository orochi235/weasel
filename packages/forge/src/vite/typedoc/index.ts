import { readFileSync, statSync } from 'node:fs';
import type { ApiMember, ApiProp } from '../../story/api.ts';
import type { ReadApi } from '../apiTable.ts';
import { packageNameOf } from '../packageName.ts';
import { indexProject, Kind, type TdIndex, type TdReflection, type TdType, type TypedocHref } from './json.ts';
import { descriptionOf, type Linker, signatureText, tagOf, unfenced } from './print.ts';

export type { TypedocHref, TypedocTarget } from './json.ts';

/** What TypeDoc's comments say about one prop or member. */
export interface EntryDocs {
  description?: string;
  deprecated?: string;
  default?: string;
  /** The type it is inherited from, when it is not declared on the one the component names. */
  inheritedFrom?: string;
}

export interface MemberDocs extends EntryDocs {
  /** A method's every overload, arrow style; empty for a property. */
  signatures: string[];
}

/** A component as TypeDoc documents it: its page, its props, and its ref handle's members, by name. */
export interface ComponentDocs {
  href?: string;
  props: Map<string, EntryDocs>;
  members: Map<string, MemberDocs>;
}

/** A TypeDoc project, read. */
export interface TypedocDocs {
  /** When its JSON was written, in ms. */
  mtime: number;
  /** The component exported as `name` and declared in `file`, an absolute path; null when TypeDoc has none. */
  component(name: string, file: string): ComponentDocs | null;
}

const slashed = (file: string) => file.replace(/\\/g, '/');

/** Reads TypeDoc's JSON, `project`, written at `mtime`; `href` names each export's page. */
export function readTypedoc(project: unknown, mtime: number, href?: TypedocHref): TypedocDocs {
  const index = indexProject(project as TdReflection);
  const linker: Linker = { index, href };
  return {
    mtime,
    component(name, file) {
      const found = exportIn(index, name, file);
      if (!found) return null;
      const props = new Map<string, TdReflection>();
      const handle: TdType[] = [];
      collect(index, propsTypeOf(index, found), props, handle, new Set());
      // A class component's ref holds its instance.
      if (found.kind === Kind.Class) handle.push({ type: 'reference', target: found.id, name: found.name });
      const ref = props.get('ref');
      if (ref?.type) handle.push(ref.type);
      props.delete('ref');
      props.delete('key');
      const members = new Map<string, TdReflection>();
      for (const type of handle) membersOf(index, handleOf(index, type), members, new Set());
      const target = index.exportOf.get(found.id);
      const page = target && href?.(target);
      return {
        ...(page ? { href: page } : {}),
        props: new Map([...props].map(([key, prop]) => [key, entryDocs(prop, prop.comment, linker)])),
        members: new Map([...members].map(([key, member]) => [key, memberDocs(member, linker)])),
      };
    },
  };
}

/** How much of `at` an export's source names, as a path suffix: 0 when none does. */
const suffixOf = (e: TdReflection, at: string): number =>
  Math.max(
    0,
    ...(e.sources ?? []).map(({ fileName }) => {
      const tail = slashed(fileName).replace(/^\.\//, '');
      return at.endsWith(`/${tail}`) ? tail.length : 0;
    }),
  );

/**
 * The component export `name` declared in `file`. TypeDoc may write each package's paths relative to that package,
 * so where two packages' files share the suffix, the one in a module named for `file`'s package is taken, else none.
 */
function exportIn(index: TdIndex, name: string, file: string): TdReflection | undefined {
  const at = slashed(file);
  const scored = index.exports
    .filter((e) => e.name === name && (e.kind === Kind.Variable || e.kind === Kind.Function || e.kind === Kind.Class))
    .map((e) => ({ e, suffix: suffixOf(e, at) }))
    .filter(({ suffix }) => suffix > 0);
  const best = Math.max(0, ...scored.map(({ suffix }) => suffix));
  const found = scored.filter(({ suffix }) => suffix === best).map(({ e }) => e);
  if (found.length <= 1) return found[0];
  const pkg = packageNameOf(file);
  const own = found.filter((e) => {
    const [outer] = index.exportOf.get(e.id)?.modules ?? [];
    return pkg !== null && (outer === pkg || outer?.startsWith(`${pkg}/`));
  });
  return own.length === 1 ? own[0] : undefined;
}

/**
 * A function component's first parameter; a class component's `P` in `Component<P>`; a value's type, such as
 * `forwardRef`'s exotic component.
 */
function propsTypeOf(index: TdIndex, component: TdReflection, seen = new Set<number>()): TdType | undefined {
  if (component.kind !== Kind.Class) return component.signatures?.[0]?.parameters?.[0]?.type ?? component.type;
  const [base] = component.extendedTypes ?? [];
  if (!base || seen.has(component.id)) return undefined;
  seen.add(component.id);
  const declared = inProject(index, base);
  return declared ? propsTypeOf(index, declared, seen) : base.typeArguments?.[0];
}

const inProject = (index: TdIndex, type: TdType): TdReflection | undefined =>
  type.type === 'reference' && typeof type.target === 'number' ? index.byId.get(type.target) : undefined;

/**
 * Every member `type` declares, into `props`. A reference outside the project is looked through to its type
 * arguments (`ForwardRefExoticComponent<P>`, `PropsWithChildren<P>`, `MemoExoticComponent<C>`), except
 * `RefAttributes<H>`, whose `H` is the ref's handle, and `Omit` and `Pick`, which drop or take their keys. Where two
 * parts declare one name, the first is kept.
 */
function collect(index: TdIndex, type: TdType | undefined, props: Map<string, TdReflection>, handle: TdType[], seen: Set<number>) {
  if (!type) return;
  if (type.type === 'intersection' || type.type === 'union') {
    for (const part of type.types ?? []) collect(index, part, props, handle, seen);
  } else if (type.type === 'indexedAccess') {
    collect(index, type.objectType, props, handle, seen);
  } else if (type.type === 'mapped') {
    collect(index, type.templateType, props, handle, seen);
  } else if (type.type === 'reflection') {
    const { children, signatures } = type.declaration ?? {};
    for (const child of children ?? []) if (!props.has(child.name)) props.set(child.name, child);
    // A lone call signature is a function component, as `memo`'s argument is: its props are its first parameter.
    if (!children?.length && signatures?.length === 1) collect(index, signatures[0]!.parameters?.[0]?.type, props, handle, seen);
  } else if (type.type === 'reference') {
    const declared = inProject(index, type);
    if (!declared) {
      const [base, keyType] = type.typeArguments ?? [];
      if (type.name === 'RefAttributes' && base) handle.push(base);
      else if ((type.name === 'Omit' || type.name === 'Pick') && base && keyType) {
        const keys = keysOf(index, keyType);
        const taken = new Map<string, TdReflection>();
        collect(index, base, taken, handle, seen);
        for (const [name, child] of taken) {
          if (keys && keys.has(name) === (type.name === 'Omit')) continue;
          if (!props.has(name)) props.set(name, child);
        }
      } else for (const argument of type.typeArguments ?? []) collect(index, argument, props, handle, seen);
      return;
    }
    if (seen.has(declared.id)) return;
    seen.add(declared.id);
    if (declared.kind === Kind.TypeAlias) collect(index, declared.type, props, handle, seen);
    else for (const child of declared.children ?? []) if (!props.has(child.name)) props.set(child.name, child);
  }
}

/** The string literals `type` names, as `Omit` and `Pick` take them; undefined where it names any other type. */
function keysOf(index: TdIndex, type: TdType): Set<string> | undefined {
  if (type.type === 'literal') return typeof type.value === 'string' ? new Set([type.value]) : undefined;
  if (type.type === 'union') {
    const keys = new Set<string>();
    for (const part of type.types ?? []) {
      const found = keysOf(index, part);
      if (!found) return undefined;
      for (const key of found) keys.add(key);
    }
    return keys;
  }
  const declared = inProject(index, type);
  return declared?.kind === Kind.TypeAlias && declared.type ? keysOf(index, declared.type) : undefined;
}

/** The project type a ref holds: `Ref<H>`, `RefObject<H | null>` and the like looked through to `H`. */
function handleOf(index: TdIndex, type: TdType): TdType | undefined {
  if (type.type === 'union') {
    for (const part of type.types ?? []) {
      const found = handleOf(index, part);
      if (found) return found;
    }
    return undefined;
  }
  if (type.type !== 'reference') return undefined;
  const declared = inProject(index, type);
  if (declared && declared.kind !== Kind.TypeAlias) return type;
  for (const argument of type.typeArguments ?? []) {
    const found = handleOf(index, argument);
    if (found) return found;
  }
  return declared ? type : undefined;
}

function membersOf(index: TdIndex, type: TdType | undefined, members: Map<string, TdReflection>, seen: Set<number>) {
  const ignored: TdType[] = [];
  collect(index, type, members, ignored, seen);
}

function entryDocs(entry: TdReflection, comment: TdReflection['comment'], linker: Linker): EntryDocs {
  const docs: EntryDocs = {};
  const description = descriptionOf(comment, linker);
  if (description) docs.description = description;
  const deprecated = tagOf(comment, ['@deprecated'], linker);
  if (deprecated !== undefined) docs.deprecated = deprecated;
  const fallback = tagOf(comment, ['@default', '@defaultValue'], linker);
  if (fallback) docs.default = unfenced(fallback);
  const from = entry.inheritedFrom?.name?.split('.')[0];
  if (from) docs.inheritedFrom = from;
  return docs;
}

function memberDocs(member: TdReflection, linker: Linker): MemberDocs {
  const signatures = member.kind === Kind.Method ? (member.signatures ?? []) : [];
  return {
    ...entryDocs(member, member.comment ?? signatures[0]?.comment ?? (member.getSignature ?? member.setSignature)?.comment, linker),
    signatures: signatures.map(signatureText),
  };
}

/**
 * TypeDoc's JSON at `file`, read again whenever it is rewritten; null while there is none, or it cannot be read.
 * `href` names each export's page.
 */
export function typedocSource(file: string, href?: TypedocHref): { docs(): TypedocDocs | null } {
  let read: { mtime: number; docs: TypedocDocs | null } | null = null;
  return {
    docs() {
      const mtime = mtimeOf(file);
      if (mtime === undefined) return (read = null);
      if (read?.mtime !== mtime) {
        let docs: TypedocDocs | null = null;
        try {
          docs = readTypedoc(JSON.parse(readFileSync(file, 'utf8')), mtime, href);
        } catch {
          docs = null;
        }
        read = { mtime, docs };
      }
      return read.docs;
    },
  };
}

/** When `file` was last modified, in ms; undefined when there is no such file. */
export function mtimeOf(file: string): number | undefined {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
}

/**
 * The API `live` read from the component's types, with what TypeDoc's comments say where TypeDoc documents the
 * component and none of the files it was read from changed after the JSON was written. The rows, their types and
 * their defaults stay the live reader's, so an edit shows at once; descriptions, deprecations, where a prop is
 * inherited from, a method's overloads and the component's page come from TypeDoc.
 */
export function withTypedoc(
  live: ReadApi,
  docs: TypedocDocs | null,
  modified: (file: string) => number | undefined = mtimeOf,
): ReadApi {
  if (!docs || !live.component) return live;
  const read = [live.component.file, ...live.sources];
  if (read.some((file) => (modified(file) ?? 0) > docs.mtime)) return live;
  const component = docs.component(live.component.name, live.component.file);
  if (!component) return live;
  const prop = (row: ApiProp): ApiProp => {
    const found = component.props.get(row.name);
    if (!found) return row;
    return {
      ...row,
      ...(row.default === undefined && found.default !== undefined ? { default: found.default } : {}),
      ...(found.description ? { description: found.description } : {}),
      ...(found.deprecated !== undefined ? { deprecated: found.deprecated } : {}),
      ...(found.inheritedFrom ? { inheritedFrom: found.inheritedFrom } : {}),
    };
  };
  const member = (row: ApiMember): ApiMember => {
    const found = component.members.get(row.name);
    if (!found) return row;
    return {
      ...row,
      ...(found.description ? { description: found.description } : {}),
      ...(found.inheritedFrom ? { inheritedFrom: found.inheritedFrom } : {}),
      ...(found.signatures.length > 1 ? { overloads: found.signatures.slice(1) } : {}),
    };
  };
  return {
    ...live,
    props: live.props.map(prop),
    ref: live.ref && { ...live.ref, members: live.ref.members.map(member) },
    ...(component.href ? { href: component.href } : {}),
  };
}
