import { describe, expect, it } from 'vitest';
import {
  DeclarationReflection, FileRegistry, ProjectReflection, ReferenceType, ReflectionCategory, ReflectionKind,
  ReflectionSymbolId,
} from 'typedoc';
import { pointAtOwners } from './pointers.mjs';

/** A merged project of two packages, built by hand: `@t/owner` declares, `@t/user` re-exports. */
function merged() {
  const project = new ProjectReflection('docs', new FileRegistry());
  const add = (name, kind, parent, symbol) => {
    const reflection = new DeclarationReflection(name, kind, parent);
    project.registerReflection(reflection, symbol && new ReflectionSymbolId(symbol), undefined);
    parent.addChild(reflection);
    return reflection;
  };
  const inOwner = (qualifiedName) => ({ packageName: '@t/owner', packagePath: 'src/shape.ts', qualifiedName });

  const owner = add('@t/owner', ReflectionKind.Module, project);
  const user = add('@t/user', ReflectionKind.Module, project);

  const shape = add('Shape', ReflectionKind.Interface, owner, inOwner('Shape'));
  const sides = add('sides', ReflectionKind.Property, shape, inOwner('Shape.sides'));

  const copy = add('Shape', ReflectionKind.Interface, user, inOwner('Shape'));
  const copiedSides = add('sides', ReflectionKind.Property, copy, inOwner('Shape.sides'));
  const unowned = add('Hidden', ReflectionKind.Interface, user, inOwner('Hidden'));

  const box = add('Box', ReflectionKind.Interface, user, {
    packageName: '@t/user', packagePath: 'src/box.ts', qualifiedName: 'Box',
  });
  box.extendedTypes = [ReferenceType.createResolvedReference('Shape', copy, project)];
  const inherited = add('sides', ReflectionKind.Property, box);
  inherited.inheritedFrom = ReferenceType.createResolvedReference('Shape.sides', copiedSides, project);

  const category = new ReflectionCategory('Shapes');
  category.children.push(copy, box);
  user.categories = [category];

  return { project, user, shape, sides, copy, unowned, box, inherited, category };
}

describe('pointAtOwners', () => {
  it("turns a re-exporter's copy into a reference to the owner's declaration", () => {
    const { project, user, shape, copy, category } = merged();

    expect(pointAtOwners(project)).toBe(1);

    const pointer = user.children.find((c) => c.name === 'Shape');
    expect(pointer.kind).toBe(ReflectionKind.Reference);
    expect(pointer.tryGetTargetReflection()).toBe(shape);
    expect(project.getReflectionById(copy.id)).toBeUndefined();
    expect(category.children[0]).toBe(pointer);
  });

  it('moves types that resolved to the copy, and to its members, onto the owner', () => {
    const { project, shape, sides, box, inherited } = merged();

    pointAtOwners(project);

    expect(box.extendedTypes[0].reflection).toBe(shape);
    expect(inherited.inheritedFrom.reflection).toBe(sides);
  });

  it('leaves a copy alone when its owner does not document the symbol', () => {
    const { project, user, unowned } = merged();

    pointAtOwners(project);

    expect(user.children).toContain(unowned);
    expect(unowned.kind).toBe(ReflectionKind.Interface);
  });
});
