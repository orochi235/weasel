/** Signatures, and the members of an interface, a class, an object type, or an enum. */
import type { JSONOutput } from 'typedoc';
import type { MemberKind, ReferenceMember, ReferenceParam, ReferenceSignature } from '../../../apps/shared/reference.ts';
import { CodeWriter, type Links } from './code.ts';
import { docOf, proseOf, tagProse } from './comments.ts';
import { Kind } from './kinds.ts';
import { isOptional, parameterName, typeCode, writeCall, writeIndex, writeType } from './types.ts';

type Declaration = JSONOutput.DeclarationReflection;
type Signature = JSONOutput.SignatureReflection;

/**
 * One overload.
 *
 * @param head what precedes the type parameters: `function clamp`, `new Box`, `static of`
 * @param fallback the declaration's own comment, for a signature that carries none
 */
export function readSignature(
  signature: Signature,
  links: Links,
  head: string,
  fallback?: JSONOutput.Comment,
): ReferenceSignature {
  const comment = signature.comment ?? fallback;
  const constructs = head.startsWith('new ');
  const w = new CodeWriter().text(head);
  writeCall(w, signature, links, constructs ? null : ': ');
  return {
    code: w.done(),
    doc: docOf(comment, links),
    params: (signature.parameters ?? []).map((parameter) => readParameter(parameter, comment, links)),
    returns: constructs ? null : readReturns(signature, comment, links),
  };
}

function readParameter(
  parameter: JSONOutput.ParameterReflection,
  comment: JSONOutput.Comment | undefined,
  links: Links,
): ReferenceParam {
  return {
    name: parameterName(parameter),
    type: typeCode(parameter.type, links),
    optional: isOptional(parameter),
    // TypeDoc moves a `@param` onto the parameter; one it could not match stays on the signature.
    doc: parameter.comment
      ? proseOf(parameter.comment.summary, links)
      : (tagProse(comment, '@param', links, parameter.name) ?? []),
  };
}

function readReturns(
  signature: Signature,
  comment: JSONOutput.Comment | undefined,
  links: Links,
): ReferenceSignature['returns'] {
  const doc = tagProse(comment, '@returns', links) ?? tagProse(comment, '@return', links) ?? [];
  const { type } = signature;
  const nothing = type?.type === 'intrinsic' && (type.name === 'void' || type.name === 'undefined');
  if (nothing && doc.length === 0) return null;
  return { type: typeCode(type, links), doc };
}

/** Every member a declaration holds, in TypeDoc's order: its call and index signatures, then its children. */
export function readMembers(owner: Declaration, links: Links): ReferenceMember[] {
  const members: ReferenceMember[] = [];
  for (const signature of owner.kind === Kind.Function ? [] : (owner.signatures ?? [])) {
    members.push(callable('call', '', readSignature(signature, links, '', owner.comment)));
  }
  for (const index of owner.indexSignatures ?? []) {
    const w = new CodeWriter();
    writeIndex(w, index, links);
    members.push({ name: '[index]', kind: 'index', code: w.done(), doc: docOf(index.comment, links) });
  }
  for (const child of owner.children ?? []) {
    if (child.flags.isPrivate) continue;
    for (const member of readMember(child, owner, links)) {
      if (child.inheritedFrom) member.inheritedFrom = typeCode(child.inheritedFrom, links);
      members.push(member);
    }
  }
  return members;
}

function callable(kind: MemberKind, name: string, signature: ReferenceSignature): ReferenceMember {
  return { name, kind, ...signature };
}

function readMember(child: Declaration, owner: Declaration, links: Links): ReferenceMember[] {
  const modifiers = `${child.flags.isProtected ? 'protected ' : ''}${child.flags.isStatic ? 'static ' : ''}${child.flags.isAbstract ? 'abstract ' : ''}`;
  switch (child.kind) {
    case Kind.Constructor:
      return (child.signatures ?? []).map((signature) =>
        callable('constructor', 'constructor', readSignature(signature, links, `new ${owner.name}`, child.comment)),
      );
    case Kind.Method:
      return (child.signatures ?? []).map((signature) =>
        callable('method', child.name, readSignature(signature, links, modifiers + child.name, child.comment)),
      );
    case Kind.Accessor:
      return readAccessor(child, modifiers, links);
    case Kind.EnumMember: {
      const w = new CodeWriter().text(`${child.name} = `);
      writeType(w, child.type, links);
      return [{ name: child.name, kind: 'value', code: w.done(), doc: docOf(child.comment, links) }];
    }
    default: {
      const w = new CodeWriter().text(
        `${modifiers}${child.flags.isReadonly ? 'readonly ' : ''}${child.name}${child.flags.isOptional ? '?' : ''}: `,
      );
      writeType(w, child.type, links);
      return [{ name: child.name, kind: 'property', code: w.done(), doc: docOf(child.comment, links) }];
    }
  }
}

function readAccessor(child: Declaration, modifiers: string, links: Links): ReferenceMember[] {
  const members: ReferenceMember[] = [];
  const { getSignature, setSignature } = child;
  if (getSignature) {
    const w = new CodeWriter().text(`${modifiers}get ${child.name}(): `);
    writeType(w, getSignature.type, links);
    members.push({ name: child.name, kind: 'accessor', code: w.done(), doc: docOf(getSignature.comment ?? child.comment, links) });
  }
  if (setSignature) {
    const w = new CodeWriter().text(`${modifiers}set ${child.name}`);
    writeCall(w, setSignature, links, null);
    members.push({ name: child.name, kind: 'accessor', code: w.done(), doc: docOf(setSignature.comment ?? child.comment, links) });
  }
  return members;
}
