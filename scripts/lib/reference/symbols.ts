/** One export of a module, read into the shape its page draws. */
import type { JSONOutput } from 'typedoc';
import type { Code, ReferenceSymbol } from '../../../apps/shared/reference.ts';
import { CodeWriter, type Links } from './code.ts';
import { docOf, summaryOf, tagProse } from './comments.ts';
import { Kind } from './kinds.ts';
import { readMembers, readSignature } from './members.ts';
import { writeType, writeTypeParameters } from './types.ts';

type Declaration = JSONOutput.DeclarationReflection;
type Child = Declaration | JSONOutput.ReferenceReflection;

/**
 * @param name the name it is listed under, which for a namespace's member is `Namespace.member`
 * @returns `null` for a kind the reference has no page for
 */
export function readSymbol(child: Child, name: string, links: Links): ReferenceSymbol | null {
  if (child.variant === 'reference') {
    const { target } = child as JSONOutput.ReferenceReflection;
    // Its source is the line that re-exports it, which says nothing the link to the declaration does not.
    return { name, summary: links.summary(target), doc: [], kind: 'alias', to: links.byId(target) ?? null };
  }
  const comment = commentOf(child);
  const source = child.sources?.[0];
  const deprecated = tagProse(comment, '@deprecated', links);
  const base = {
    name,
    summary: summaryOf(comment),
    doc: docOf(child.comment, links),
    ...(deprecated ? { deprecated } : {}),
    ...(source ? { source: { file: source.fileName, line: source.line, ...(source.url ? { url: source.url } : {}) } } : {}),
  };

  switch (child.kind) {
    case Kind.Function:
      return {
        ...base,
        // Each overload shows its own comment, so the function's is not shown a second time.
        doc: [],
        kind: 'function',
        signatures: (child.signatures ?? []).map((signature) =>
          readSignature(signature, links, `function ${name}`, child.comment),
        ),
      };
    case Kind.Class:
      return { ...base, kind: 'class', code: heritage(child, `${child.flags.isAbstract ? 'abstract ' : ''}class`, links), members: readMembers(child, links) };
    case Kind.Interface:
      return { ...base, kind: 'interface', code: heritage(child, 'interface', links), members: readMembers(child, links) };
    case Kind.Enum:
      return { ...base, kind: 'enum', code: [`enum ${name}`], members: readMembers(child, links) };
    case Kind.TypeAlias:
      return { ...base, kind: 'type', ...shaped(child, `type ${name}`, ' = ', links) };
    case Kind.Variable:
      return { ...base, kind: 'variable', ...shaped(child, `${child.flags.isConst ? 'const' : 'let'} ${name}`, ': ', links) };
    default:
      return null;
  }
}

/**
 * The comment an export's summary is read from. A function documents itself on its signatures, so it is the
 * first one's unless the declaration's own has a summary: core's categorizer gives every function a
 * declaration comment holding only `@category`.
 */
export function commentOf(child: Child): JSONOutput.Comment | undefined {
  const own = child.comment;
  if (child.kind !== Kind.Function || (own && own.summary.length > 0)) return own;
  return (child as Declaration).signatures?.[0]?.comment ?? own;
}

/** `class Box<T> extends Shape implements Sized`. */
function heritage(child: Declaration, keyword: string, links: Links): Code {
  const w = new CodeWriter().text(`${keyword} ${child.name}`);
  writeTypeParameters(w, child.typeParameters, links);
  const clause = (word: string, types: readonly JSONOutput.SomeType[] | undefined) => {
    if (!types || types.length === 0) return;
    w.text(` ${word} `);
    w.each(types, ', ', (type) => writeType(w, type, links));
  };
  clause('extends', child.extendedTypes);
  clause('implements', child.implementedTypes);
  return w.done();
}

/**
 * A type alias or a variable. One whose type is an object literal lists that
 * object's fields as members, where each can carry its comment; any other
 * type is written out whole.
 */
function shaped(child: Declaration, head: string, joiner: string, links: Links) {
  const w = new CodeWriter().text(head);
  writeTypeParameters(w, child.typeParameters, links);
  const literal = child.type?.type === 'reflection' ? child.type.declaration : undefined;
  if (literal && (literal.children?.length ?? 0) > 0) {
    return { code: w.text(`${joiner}{ … }`).done(), members: readMembers(literal, links) };
  }
  w.text(joiner);
  writeType(w, child.type, links);
  return { code: w.done(), members: [] };
}
