import type { TdComment, TdIndex, TdPart, TdReflection, TdType, TypedocHref } from './json.ts';

/** A type as TypeScript would print it. */
export function typeText(type: TdType | undefined): string {
  if (!type) return 'unknown';
  switch (type.type) {
    case 'intrinsic':
    case 'inferred':
    case 'unknown':
      return type.name ?? 'unknown';
    case 'literal':
      return literalText(type.value);
    case 'reference':
      return `${type.name ?? ''}${type.typeArguments?.length ? `<${type.typeArguments.map(typeText).join(', ')}>` : ''}`;
    case 'union':
      return (type.types ?? []).map(typeText).join(' | ');
    case 'intersection':
      return (type.types ?? []).map((t) => grouped(t, ['union'])).join(' & ');
    case 'array':
      return `${grouped(type.elementType, ['union', 'intersection', 'conditional', 'reflection'])}[]`;
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
      return `${type.operator} ${typeText(type.target as TdType)}`;
    case 'indexedAccess':
      return `${typeText(type.objectType)}[${typeText(type.indexType)}]`;
    case 'conditional':
      return `${typeText(type.checkType)} extends ${typeText(type.extendsType)} ? ${typeText(type.trueType)} : ${typeText(type.falseType)}`;
    case 'templateLiteral':
      return `\`${type.head ?? ''}${(type.tail ?? []).map(([t, text]) => `\${${typeText(t)}}${text}`).join('')}\``;
    case 'predicate':
      return `${type.asserts ? 'asserts ' : ''}${type.name}${type.targetType ? ` is ${typeText(type.targetType)}` : ''}`;
    case 'mapped':
      return `{ [${type.parameter} in ${typeText(type.parameterType)}]: ${typeText(type.templateType)} }`;
    case 'reflection':
      return reflectionText(type.declaration);
    default:
      return type.name ?? 'unknown';
  }
}

function literalText(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value).replace(/^"|"$/g, "'");
  if (value && typeof value === 'object' && 'value' in value) {
    const big = value as { negative?: boolean; value: string };
    return `${big.negative ? '-' : ''}${big.value}n`;
  }
  return String(value);
}

function grouped(type: TdType | undefined, wrap: readonly string[]): string {
  const text = typeText(type);
  return type && wrap.includes(type.type) ? `(${text})` : text;
}

function reflectionText(declaration: TdReflection | undefined): string {
  if (!declaration) return '{}';
  const [signature] = declaration.signatures ?? [];
  if (signature && !declaration.children?.length) return signatureText(signature);
  const members = (declaration.children ?? []).map((c) => `${c.name}${c.flags?.isOptional ? '?' : ''}: ${typeText(c.type)}`);
  return members.length ? `{ ${members.join('; ')} }` : '{}';
}

/** A call signature, arrow style. */
export function signatureText(signature: TdReflection): string {
  const generics = signature.typeParameters?.length ? `<${signature.typeParameters.map((t) => t.name).join(', ')}>` : '';
  const params = (signature.parameters ?? []).map(
    (p) => `${p.flags?.isRest ? '...' : ''}${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeText(p.type)}`,
  );
  return `${generics}(${params.join(', ')}) => ${typeText(signature.type)}`;
}

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
