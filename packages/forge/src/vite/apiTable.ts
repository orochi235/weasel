import type ts from 'typescript';
import type { ApiInherited, ApiMember, ApiProp, ApiRef, ApiTable, ApiTypeDef } from '../story/api.ts';
import { addTypeDef, addTypeDefs } from './typeDefs.ts';

/** What reading one story file's component API needs. */
export interface ApiReading {
  tsm: typeof ts;
  checker: ts.TypeChecker;
  at: ts.SourceFile;
  /** True for a file whose declarations are inherited rather than listed: the platform's, or a skipped package's. */
  skipped: (file: string) => boolean;
  /** True for a file of the platform's own: React's types or TypeScript's libraries. */
  platform: (file: string) => boolean;
}

/** An API as read, with the project files it is declared in, which the plugin watches and the page never sees. */
export type ReadApi = ApiTable & {
  sources: string[];
  /** The component's declared name and the file it is declared in, by which TypeDoc's output is searched. */
  component?: { name: string; file: string };
};

const RESERVED = new Set(['ref', 'key']);
const IN_PACKAGES = /[\\/]node_modules[\\/]/;

/** Every prop of `props`, the props it inherits counted per declaring type, and what its `ref` exposes. */
export function apiTable(reading: ApiReading, declaration: ts.Declaration | undefined, props: ts.Type | null): ReadApi {
  const { checker } = reading;
  const sources = new Set<string>();
  const record = (symbol: ts.Symbol) => {
    for (const file of filesOf(symbol)) if (!IN_PACKAGES.test(file)) sources.add(file);
  };
  const defaults = declaration ? destructuredDefaults(reading.tsm, declaration) : new Map<string, string>();
  const listed: ApiProp[] = [];
  const inherited = new Map<string, number>();
  let ref: ApiRef | null = null;
  const defs = new Map<string, ApiTypeDef>();
  const define = (symbol: ts.Symbol, text: string) =>
    addTypeDefs(reading, symbol.getDeclarations()?.[0] ?? reading.at, text, defs);
  for (const prop of props ? checker.getPropertiesOfType(checker.getApparentType(props)) : []) {
    const name = prop.getName();
    if (name === 'ref') ref = refOf(reading, prop, record, define, (symbol) => addTypeDef(reading, symbol, defs));
    if (RESERVED.has(name)) continue;
    const files = filesOf(prop);
    if (files.length > 0 && files.every(reading.skipped)) {
      const from = containerName(reading.tsm, prop) ?? packageOf(files[0]!);
      inherited.set(from, (inherited.get(from) ?? 0) + 1);
      continue;
    }
    const entry = propEntry(reading, prop, defaults.get(name));
    listed.push(entry);
    define(prop, entry.type);
    record(prop);
  }
  return {
    props: listed,
    inherited: [...inherited].map(([from, count]): ApiInherited => ({ from, count })),
    ref,
    ...(defs.size === 0 ? {} : { types: Object.fromEntries(defs) }),
    sources: [...sources],
    ...componentOf(reading.tsm, declaration),
  };
}

function componentOf(tsm: typeof ts, declaration: ts.Declaration | undefined): Pick<ReadApi, 'component'> {
  const name = declaration && tsm.getNameOfDeclaration(declaration);
  return name && tsm.isIdentifier(name) ? { component: { name: name.text, file: declaration.getSourceFile().fileName } } : {};
}

const filesOf = (symbol: ts.Symbol): string[] =>
  (symbol.getDeclarations() ?? []).map((declaration) => declaration.getSourceFile().fileName);

const docOf = ({ tsm, checker }: ApiReading, symbol: ts.Symbol): string =>
  tsm.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();

function tagText({ tsm, checker }: ApiReading, symbol: ts.Symbol, names: readonly string[]): string | undefined {
  const tag = symbol.getJsDocTags(checker).find((t) => names.includes(t.name));
  return tag ? tsm.displayPartsToString(tag.text).trim() : undefined;
}

function propEntry(reading: ApiReading, prop: ts.Symbol, destructured: string | undefined): ApiProp {
  const entry: ApiProp = {
    name: prop.getName(),
    type: writtenType(reading, prop),
    required: !(prop.flags & reading.tsm.SymbolFlags.Optional),
  };
  const fallback = destructured ?? tagText(reading, prop, ['default', 'defaultValue']);
  if (fallback) entry.default = fallback;
  const description = docOf(reading, prop);
  if (description) entry.description = description;
  const deprecated = tagText(reading, prop, ['deprecated']);
  if (deprecated !== undefined) entry.deprecated = deprecated;
  return entry;
}

/**
 * The type as its one declaration spells it, when that is the type the prop has here; otherwise, as for a prop
 * inherited through a generic base or a method-shorthand one, as the checker prints it, untruncated.
 */
function writtenType({ tsm, checker, at }: ApiReading, symbol: ts.Symbol): string {
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, at));
  const [declaration, ...others] = symbol.getDeclarations() ?? [];
  const node = declaration && others.length === 0 && tsm.isPropertySignature(declaration) ? declaration.type : undefined;
  if (node && checker.getNonNullableType(checker.getTypeFromTypeNode(node)) === type) return node.getText().replace(/\s+/g, ' ');
  return checker.typeToString(type, undefined, tsm.TypeFormatFlags.NoTruncation);
}

/** The package a file is in, `@scope/name` or `name`, else the file's own name. */
function packageOf(file: string): string {
  const parts = file.split(/[\\/]/);
  const at = parts.lastIndexOf('node_modules');
  if (at < 0 || at + 1 >= parts.length) return parts.at(-1) ?? file;
  const name = parts[at + 1]!;
  return name.startsWith('@') && parts[at + 2] ? `${name}/${parts[at + 2]}` : name;
}

/** The interface, type alias or class a property is declared in, by name. */
function containerName(tsm: typeof ts, prop: ts.Symbol): string | undefined {
  const parent = prop.getDeclarations()?.[0]?.parent;
  if (!parent) return undefined;
  if (tsm.isInterfaceDeclaration(parent) || tsm.isClassDeclaration(parent)) return parent.name?.text;
  if (tsm.isTypeLiteralNode(parent) && tsm.isTypeAliasDeclaration(parent.parent)) return parent.parent.name.text;
  return undefined;
}

/** What `ref` holds: the type of `current` on the ref object it accepts. */
function refOf(
  reading: ApiReading,
  prop: ts.Symbol,
  record: (symbol: ts.Symbol) => void,
  define: (symbol: ts.Symbol, text: string) => void,
  defineType: (symbol: ts.Symbol) => void,
): ApiRef | null {
  const { tsm, checker, at } = reading;
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, at));
  for (const part of type.isUnion() ? type.types : [type]) {
    const current = part.getProperty('current');
    if (!current) continue;
    const held = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(current, at));
    const name = checker.typeToString(held, undefined, tsm.TypeFormatFlags.NoTruncation);
    const named = held.aliasSymbol ?? held.getSymbol();
    if (named) defineType(named);
    const declared = (held.getSymbol() ?? held.aliasSymbol)?.getDeclarations() ?? [];
    if (declared.length > 0 && declared.every((d) => reading.platform(d.getSourceFile().fileName))) {
      return { type: name, members: [] };
    }
    const members = checker.getPropertiesOfType(held).map((member) => {
      record(member);
      const entry = memberEntry(reading, member);
      define(member, entry.signature);
      return entry;
    });
    return { type: name, members };
  }
  return null;
}

function memberEntry(reading: ApiReading, member: ts.Symbol): ApiMember {
  const { tsm, checker, at } = reading;
  const type = checker.getTypeOfSymbolAtLocation(member, at);
  const [call] = type.getCallSignatures();
  const declarations = member.getDeclarations() ?? [];
  const entry: ApiMember = {
    name: member.getName(),
    kind: call ? 'method' : 'property',
    signature: call
      ? checker.signatureToString(call, undefined, tsm.TypeFormatFlags.WriteArrowStyleSignature | tsm.TypeFormatFlags.NoTruncation)
      : checker.typeToString(type, undefined, tsm.TypeFormatFlags.NoTruncation),
    readonly: declarations.some((d) => (tsm.getCombinedModifierFlags(d) & tsm.ModifierFlags.Readonly) !== 0),
  };
  const description = docOf(reading, member);
  if (description) entry.description = description;
  return entry;
}

/** The defaults the component's own function gives its destructured props, as source text, by prop name. */
function destructuredDefaults(tsm: typeof ts, declaration: ts.Declaration): Map<string, string> {
  const defaults = new Map<string, string>();
  let node: ts.Node | undefined = tsm.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
  while (node && (tsm.isCallExpression(node) || tsm.isParenthesizedExpression(node) || tsm.isAsExpression(node))) {
    node = tsm.isCallExpression(node) ? node.arguments[0] : node.expression;
  }
  if (!node || !(tsm.isArrowFunction(node) || tsm.isFunctionExpression(node) || tsm.isFunctionDeclaration(node))) {
    return defaults;
  }
  const pattern = node.parameters[0]?.name;
  if (!pattern || !tsm.isObjectBindingPattern(pattern)) return defaults;
  for (const element of pattern.elements) {
    const key = element.propertyName ?? element.name;
    if (element.initializer && tsm.isIdentifier(key)) defaults.set(key.text, element.initializer.getText());
  }
  return defaults;
}
