import { Reflection, ReferenceReflection, ReferenceType, ReflectionKind, makeRecursiveVisitor } from 'typedoc';

/**
 * TypeDoc converts each package on its own, so a symbol one package declares
 * and another re-exports is documented in full under both. Once the packages
 * are merged, turn the re-exporter's copy into a reference to the owner's, and
 * move everything that pointed at the copy.
 *
 * A copy whose owner does not document the symbol stays a declaration.
 *
 * @param {import('typedoc').ProjectReflection} project the merged project
 * @returns {number} how many copies became references
 */
export function pointAtOwners(project) {
  const packages = (project.children ?? []).filter((c) => c.kind === ReflectionKind.Module);
  const byName = new Map(packages.map((p) => [p.name, p]));

  /** @type {Map<number, number>} a copy's id, or one of its descendants', to the owner's */
  const moved = new Map();
  /** @type {{ copy: import('typedoc').DeclarationReflection, owner: import('typedoc').DeclarationReflection }[]} */
  const swaps = [];

  for (const pkg of packages) {
    for (const copy of exportsOf(pkg)) {
      const id = declaredId(project, copy);
      if (!id || id.packageName === pkg.name) continue;
      const owner = declarationsOf(project, byName.get(id.packageName)).get(id.getStableKey());
      if (!owner) continue;
      pair(copy, owner, moved);
      swaps.push({ copy, owner });
    }
  }
  if (swaps.length === 0) return 0;

  retarget(project, moved);
  for (const { copy, owner } of swaps) {
    const parent = /** @type {import('typedoc').ContainerReflection} */ (copy.parent);
    const pointer = new ReferenceReflection(copy.name, owner, parent);
    project.registerReflection(pointer, undefined, undefined);
    for (const list of listsHolding(parent)) {
      const at = list.indexOf(copy);
      if (at !== -1) list[at] = pointer;
    }
    project.removeReflection(copy);
  }
  return swaps.length;
}

/** A package's exports: its own, and those of each subpath entry under it. */
function exportsOf(pkg) {
  const own = pkg.children ?? [];
  return own.flatMap((c) => (c.kind === ReflectionKind.Module ? (c.children ?? []) : [c]));
}

const DECLARATIONS = new WeakMap();

/** A package's declarations by symbol, the root entry's ahead of a subpath's. */
function declarationsOf(project, pkg) {
  if (!pkg) return new Map();
  let index = DECLARATIONS.get(pkg);
  if (!index) {
    index = new Map();
    const rootFirst = [...exportsOf(pkg)].sort((a, b) => Number(a.parent !== pkg) - Number(b.parent !== pkg));
    for (const child of rootFirst) {
      const key = declaredId(project, child)?.getStableKey();
      if (key && !index.has(key)) index.set(key, child);
    }
    DECLARATIONS.set(pkg, index);
  }
  return index;
}

/** The symbol a declaration was converted from; nothing for a reference, which has no copy to fold. */
function declaredId(project, reflection) {
  if (reflection.kind === ReflectionKind.Reference) return undefined;
  return project.getSymbolIdFromReflection(reflection);
}

/** Walk two conversions of one declaration in step, recording each id in the first against the second. */
function pair(copy, owner, moved) {
  moved.set(copy.id, owner.id);
  const theirs = childrenOf(owner);
  const seen = new Map();
  for (const mine of childrenOf(copy)) {
    const key = `${mine.kind}:${mine.name}`;
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    const match = theirs.filter((t) => `${t.kind}:${t.name}` === key)[nth];
    if (match) pair(mine, match, moved);
  }
}

function childrenOf(reflection) {
  const out = [];
  reflection.traverse((child) => {
    out.push(child);
    return true;
  });
  // An inline object type's members hang off the type, which `traverse` reaches only for some kinds.
  const inline = reflection.type?.type === 'reflection' ? reflection.type.declaration : undefined;
  if (inline && !out.includes(inline)) out.push(inline);
  return out;
}

/** Every array a container lists its children in. */
function listsHolding(parent) {
  const lists = [parent.children, parent.childrenIncludingDocuments];
  for (const group of parent.groups ?? []) {
    lists.push(group.children);
    for (const category of group.categories ?? []) lists.push(category.children);
  }
  for (const category of parent.categories ?? []) lists.push(category.children);
  return lists.filter(Boolean);
}

/** Point every type, reference, and link at a moved reflection's new id. */
function retarget(project, moved) {
  const visitor = makeRecursiveVisitor({
    reference(type) {
      // `_target` is private, and nothing public moves a resolved reference.
      if (typeof type._target === 'number' && moved.has(type._target)) type._target = moved.get(type._target);
    },
  });
  const visit = (type) => {
    if (Array.isArray(type)) type.forEach(visit);
    else if (type instanceof ReferenceType || type?.visit) type.visit(visitor);
  };
  const relink = (parts) => {
    for (const part of parts ?? []) {
      if (part.kind === 'inline-tag' && part.target instanceof Reflection && moved.has(part.target.id)) {
        part.target = project.getReflectionById(moved.get(part.target.id));
      }
    }
  };

  relink(project.readme);
  for (const reflection of Object.values(project.reflections)) {
    if (reflection instanceof ReferenceReflection && moved.has(reflection._target)) {
      reflection._target = moved.get(reflection._target);
    }
    for (const key of TYPE_FIELDS) visit(reflection[key]);
    relink(reflection.comment?.summary);
    for (const tag of reflection.comment?.blockTags ?? []) relink(tag.content);
    relink(reflection.readme);
    relink(reflection.content);
  }
}

const TYPE_FIELDS = [
  'type', 'default', 'overwrites', 'inheritedFrom', 'implementationOf',
  'extendedTypes', 'extendedBy', 'implementedTypes', 'implementedBy',
];
