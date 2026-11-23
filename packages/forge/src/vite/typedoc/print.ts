import type { TdComment, TdIndex, TdPart, TdReflection, TdType, TypedocHref } from './json.ts';

/** A type as TypeScript would print it. */
export function typeText(type: TdType | undefined): string {
  if (!type) return 'unknown';
  switch (type.type) {
    case 'inferred':
      return `infer ${type.name ?? 'unknown'}${type.constraint ? ` extends ${typeText(type.constraint)}` : ''}`;
    case 'intrinsic':
    case 'unknown':
      return type.name ?? 'unknown';
    case 'literal':
      return literalText(type.value);
    case 'reference':
      return `${type.name ?? ''}${type.typeArguments?.length ? `<${type.typeArguments.map(typeText).join(', ')}>` : ''}`;
    case 'union':
      return (type.types ?? []).map((t) => grouped(t, ['function', 'conditional'])).join(' | ');
    case 'intersection':
      return (type.types ?? []).map((t) => grouped(t, ['union', 'function', 'conditional'])).join(' & ');
    case 'array':
      return `${grouped(type.elementType, POSTFIX)}[]`;
    case 'tuple':
      return `[${(type.elements ?? []).map(typeText).join(', ')}]`;
    case 'namedTupleMember':
      return `${type.name}${type.isOptional ? '?' : ''}: ${typeText(type.element)}`;
    case 'optional':
      return `${typeText(type.elementType)}?`;
    case 'rest':
      return `...${typeText(type.elementType)}`;
    case 'query':
      return `typeof ${typeText(type.queryType)}`;
    case 'typeOperator':
      return `${type.operator} ${grouped(type.target as TdType, ['union', 'intersection', 'function', 'conditional'])}`;
    case 'indexedAccess':
      return `${grouped(type.objectType, POSTFIX)}[${typeText(type.indexType)}]`;
    case 'conditional':
      return `${typeText(type.checkType)} extends ${typeText(type.extendsType)} ? ${typeText(type.trueType)} : ${typeText(type.falseType)}`;
    case 'templateLiteral':
      return `\`${type.head ?? ''}${(type.tail ?? []).map(([t, text]) => `\${${typeText(t)}}${text}`).join('')}\``;
    case 'predicate':
      return `${type.asserts ? 'asserts ' : ''}${type.name}${type.targetType ? ` is ${typeText(type.targetType)}` : ''}`;
    case 'mapped': {
      const readonly = type.readonlyModifier === '+' ? 'readonly ' : type.readonlyModifier === '-' ? '-readonly ' : '';
      const optional = type.optionalModifier === '+' ? '?' : type.optionalModifier === '-' ? '-?' : '';
      const as = type.nameType ? ` as ${typeText(type.nameType)}` : '';
      return `{ ${readonly}[${type.parameter} in ${typeText(type.parameterType)}${as}]${optional}: ${typeText(type.templateType)} }`;
    }
    case 'reflection':
      return reflectionText(type.declaration);
    default:
      return type.name ?? 'unknown';
  }
}

function literalText(value: unknown): string {
  if (typeof value === 'string') {
    return `'${JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const big = value as { negative?: boolean; value: string };
    return `${big.negative ? '-' : ''}${big.value}n`;
  }
  return String(value);
}

/** What binds looser than a postfix `[]` or `[K]`. */
const POSTFIX = ['union', 'intersection', 'conditional', 'function', 'typeOperator'];

/** `type`, parenthesized when its kind is one of `wrap`; a reflection printed as a signature is kind `function`. */
function grouped(type: TdType | undefined, wrap: readonly string[]): string {
  const text = typeText(type);
  if (!type) return text;
  const kind = type.type === 'reflection' && isSignature(type.declaration) ? 'function' : type.type;
  return wrap.includes(kind) ? `(${text})` : text;
}

const isSignature = (declaration: TdReflection | undefined): boolean =>
  !!declaration?.signatures?.length && !declaration.children?.length;

function reflectionText(declaration: TdReflection | undefined): string {
  if (!declaration) return '{}';
  const [signature] = declaration.signatures ?? [];
  if (signature && isSignature(declaration)) return signatureText(signature);
  const members = (declaration.children ?? []).map((c) => `${c.name}${c.flags?.isOptional ? '?' : ''}: ${typeText(c.type)}`);
  return members.length ? `{ ${members.join('; ')} }` : '{}';
}

/** A call signature, arrow style. */
export function signatureText(signature: TdReflection): string {
  const generics = signature.typeParameters?.length ? `<${signature.typeParameters.map(typeParameterText).join(', ')}>` : '';
  const params = (signature.parameters ?? []).map(
    (p) => `${p.flags?.isRest ? '...' : ''}${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeText(p.type)}`,
  );
  return `${generics}(${params.join(', ')}) => ${typeText(signature.type)}`;
}

const typeParameterText = (t: TdReflection): string =>
  `${t.name}${t.type ? ` extends ${typeText(t.type)}` : ''}${t.default ? ` = ${typeText(t.default)}` : ''}`;

/** How a comment's `{@link}` targets become hrefs. */
export interface Linker {
  index: TdIndex;
  href: TypedocHref | undefined;
}

/** Comment text as inline markdown, each `{@link}` a link to the page it names, else its name as code. */
export function markdownOf(parts: readonly TdPart[] | undefined, linker: Linker): string {
  return (parts ?? []).map((part) => (part.kind === 'inline-tag' ? inlineTag(part, linker) : part.text)).join('');
}

function inlineTag(part: TdPart, { index, href }: Linker): string {
  if (!part.tag?.startsWith('@link')) return part.text;
  const label = part.tag === '@linkplain' ? part.text : `\`${part.text}\``;
  const { target } = part;
  const exported = typeof target === 'number' ? index.exportOf.get(target) : undefined;
  const to = typeof target === 'string' ? target : exported && href?.(exported);
  return to ? `[${label}](${to})` : label;
}

/** A comment's summary, then its `@remarks`, then each `@see`: paragraphs, as the panel draws a description. */
export function descriptionOf(comment: TdComment | undefined, linker: Linker): string | undefined {
  if (!comment) return undefined;
  const sections = [markdownOf(comment.summary, linker)];
  for (const tag of comment.blockTags ?? []) {
    if (tag.tag === '@remarks') sections.push(markdownOf(tag.content, linker));
  }
  for (const tag of comment.blockTags ?? []) {
    if (tag.tag === '@see') sections.push(`See also ${markdownOf(tag.content, linker)}`);
  }
  const text = sections.map((s) => s.trim()).filter(Boolean).join('\n\n');
  return text || undefined;
}

/** What a block tag says, as markdown; undefined when the comment has no such tag. */
export function tagOf(comment: TdComment | undefined, names: readonly string[], linker: Linker): string | undefined {
  const tag = comment?.blockTags?.find((t) => names.includes(t.tag));
  return tag ? markdownOf(tag.content, linker).trim() : undefined;
}

/** A `@default` tag's value as source text, without the code fence TypeDoc puts around it. */
export const unfenced = (text: string): string => /^```\w*\n([\s\S]*?)\n```$/.exec(text)?.[1] ?? text;
