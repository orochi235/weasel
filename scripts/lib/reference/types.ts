/**
 * TypeDoc's serialized types, written back out as the TypeScript a reader
 * would recognize, with each name that has a page linked to it.
 */
import type { JSONOutput } from 'typedoc';
import type { Code } from '../../../apps/shared/reference.ts';
import { CodeWriter, type Links } from './code.ts';
import { Kind } from './kinds.ts';

type SomeType = JSONOutput.SomeType;

/** Where a type sits, which decides whether it needs parentheses to read the same. */
type Position = 'top' | 'member' | 'operand';

/** A type as code. */
export function typeCode(type: SomeType | undefined, links: Links): Code {
  const w = new CodeWriter();
  writeType(w, type, links);
  return w.done();
}

export function writeType(w: CodeWriter, type: SomeType | undefined, links: Links, at: Position = 'top'): void {
  if (!type) {
    w.text('unknown');
    return;
  }
  const wrap = needsParens(type, at);
  if (wrap) w.text('(');
  writeBare(w, type, links);
  if (wrap) w.text(')');
}

function needsParens(type: SomeType, at: Position): boolean {
  if (at === 'top') return false;
  const callable = type.type === 'reflection' && (type.declaration.signatures?.length ?? 0) > 0;
  if (callable || type.type === 'conditional') return true;
  if (at === 'member') return false;
  return ['union', 'intersection', 'typeOperator', 'inferred', 'query'].includes(type.type);
}

function writeBare(w: CodeWriter, type: SomeType, links: Links): void {
  const sub = (inner: SomeType | undefined, at: Position = 'top') => writeType(w, inner, links, at);
  switch (type.type) {
    case 'array':
      sub(type.elementType, 'operand');
      w.text('[]');
      return;
    case 'conditional':
      sub(type.checkType, 'operand');
      w.text(' extends ');
      sub(type.extendsType, 'operand');
      w.text(' ? ');
      sub(type.trueType);
      w.text(' : ');
      sub(type.falseType);
      return;
    case 'indexedAccess':
      sub(type.objectType, 'operand');
      w.text('[');
      sub(type.indexType);
      w.text(']');
      return;
    case 'inferred':
      w.text(`infer ${type.name}`);
      if (type.constraint) {
        w.text(' extends ');
        sub(type.constraint, 'operand');
      }
      return;
    case 'intersection':
      w.each(type.types, ' & ', (member) => sub(member, member.type === 'union' ? 'operand' : 'member'));
      return;
    case 'union':
      w.each(type.types, ' | ', (member) => sub(member, 'member'));
      return;
    case 'intrinsic':
    case 'unknown':
      w.text(type.name);
      return;
    case 'literal':
      w.text(literal(type.value));
      return;
    case 'mapped':
      writeMapped(w, type, links);
      return;
    case 'namedTupleMember':
      w.text(`${type.name}${type.isOptional ? '?' : ''}: `);
      sub(type.element);
      return;
    case 'optional':
      sub(type.elementType, 'operand');
      w.text('?');
      return;
    case 'predicate':
      w.text(`${type.asserts ? 'asserts ' : ''}${type.name}`);
      if (type.targetType) {
        w.text(' is ');
        sub(type.targetType);
      }
      return;
    case 'query':
      w.text('typeof ');
      sub(type.queryType);
      return;
    case 'reference':
      writeReference(w, type, links);
      return;
    case 'reflection':
      writeLiteral(w, type.declaration, links);
      return;
    case 'rest':
      w.text('...');
      sub(type.elementType, 'operand');
      return;
    case 'templateLiteral':
      w.text('`' + type.head);
      for (const [hole, text] of type.tail) {
        w.text('${');
        sub(hole);
        w.text('}' + text);
      }
      w.text('`');
      return;
    case 'tuple':
      w.text('[');
      w.each(type.elements ?? [], ', ', (element) => sub(element));
      w.text(']');
      return;
    case 'typeOperator':
      w.text(`${type.operator} `);
      sub(type.target, type.target.type === 'array' ? 'top' : 'operand');
      return;
  }
}

function literal(value: JSONOutput.LiteralType['value']): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') return `${value.negative ? '-' : ''}${value.value}n`;
  return String(value);
}

function writeReference(w: CodeWriter, type: JSONOutput.ReferenceType, links: Links): void {
  const to = type.refersToTypeParameter
    ? undefined
    : typeof type.target === 'number'
      ? links.byId(type.target)
      : links.byName(type.package, type.qualifiedName ?? type.name);
  w.name(type.name, to);
  const args = type.typeArguments ?? [];
  if (args.length === 0) return;
  w.text('<');
  w.each(args, ', ', (arg) => writeType(w, arg, links));
  w.text('>');
}

function writeMapped(w: CodeWriter, type: JSONOutput.MappedType, links: Links): void {
  const signed = (modifier: '+' | '-' | undefined, text: string) =>
    modifier === undefined ? '' : modifier === '-' ? `-${text}` : text;
  const readonly = signed(type.readonlyModifier, 'readonly ');
  const optional = signed(type.optionalModifier, '?');
  w.text(`{ ${readonly}[${type.parameter} in `);
  writeType(w, type.parameterType, links);
  if (type.nameType) {
    w.text(' as ');
    writeType(w, type.nameType, links);
  }
  w.text(`]${optional}: `);
  writeType(w, type.templateType, links);
  w.text(' }');
}

/** A type literal: a function type when it has one signature and nothing else, an object type otherwise. */
function writeLiteral(w: CodeWriter, declaration: JSONOutput.DeclarationReflection, links: Links): void {
  const signatures = declaration.signatures ?? [];
  const children = declaration.children ?? [];
  const indexes = declaration.indexSignatures ?? [];
  if (signatures.length === 1 && children.length === 0 && indexes.length === 0) {
    writeCall(w, signatures[0], links, ' => ');
    return;
  }
  const lines: (() => void)[] = [
    ...signatures.map((signature) => () => writeCall(w, signature, links, ': ')),
    ...indexes.map((index) => () => writeIndex(w, index, links)),
    ...children.map((child) => () => writeField(w, child, links)),
  ];
  if (lines.length === 0) {
    w.text('{}');
    return;
  }
  w.text('{ ');
  w.each(lines, '; ', (line) => line());
  w.text(' }');
}

function writeField(w: CodeWriter, field: JSONOutput.DeclarationReflection, links: Links): void {
  const signature = field.kind === Kind.Method ? field.signatures?.[0] : undefined;
  if (signature) {
    w.text(field.name);
    writeCall(w, signature, links, ': ');
    return;
  }
  w.text(`${field.flags.isReadonly ? 'readonly ' : ''}${field.name}${field.flags.isOptional ? '?' : ''}: `);
  writeType(w, field.type ?? field.getSignature?.type, links);
}

/** `[key: string]: T`. */
export function writeIndex(w: CodeWriter, index: JSONOutput.SignatureReflection, links: Links): void {
  w.text('[');
  w.each(index.parameters ?? [], ', ', (parameter) => writeParameter(w, parameter, links));
  w.text(']: ');
  writeType(w, index.type, links);
}

/** A signature from its type parameters on: `<T>(a: T): T`, with `arrow` between the parameters and the result. */
export function writeCall(
  w: CodeWriter,
  signature: JSONOutput.SignatureReflection,
  links: Links,
  arrow: ': ' | ' => ' | null,
): void {
  writeTypeParameters(w, signature.typeParameters, links);
  w.text('(');
  w.each(signature.parameters ?? [], ', ', (parameter) => writeParameter(w, parameter, links));
  w.text(')');
  if (arrow === null) return;
  w.text(arrow);
  writeType(w, signature.type, links);
}

export function writeTypeParameters(
  w: CodeWriter,
  parameters: readonly JSONOutput.TypeParameterReflection[] | undefined,
  links: Links,
): void {
  if (!parameters || parameters.length === 0) return;
  w.text('<');
  w.each(parameters, ', ', (parameter) => {
    w.text(`${parameter.flags.isConst ? 'const ' : ''}${parameter.varianceModifier ? `${parameter.varianceModifier} ` : ''}${parameter.name}`);
    if (parameter.type) {
      w.text(' extends ');
      writeType(w, parameter.type, links);
    }
    if (parameter.default) {
      w.text(' = ');
      writeType(w, parameter.default, links);
    }
  });
  w.text('>');
}

/** The name TypeDoc gives a destructured parameter, which no caller ever writes. */
const DESTRUCTURED = '__namedParameters';

export function parameterName(parameter: JSONOutput.ParameterReflection): string {
  return parameter.name === DESTRUCTURED ? 'options' : parameter.name;
}

/** True when a caller may leave the parameter out. */
export function isOptional(parameter: JSONOutput.ParameterReflection): boolean {
  return parameter.flags.isOptional === true || parameter.defaultValue !== undefined;
}

function writeParameter(w: CodeWriter, parameter: JSONOutput.ParameterReflection, links: Links): void {
  const rest = parameter.flags.isRest ? '...' : '';
  w.text(`${rest}${parameterName(parameter)}${isOptional(parameter) && !rest ? '?' : ''}: `);
  writeType(w, parameter.type, links);
}
