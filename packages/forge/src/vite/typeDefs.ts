import type ts from 'typescript';
import type { ApiTypeDef } from '../story/api.ts';

/** What reading a type's definition needs. */
export interface TypeDefReading {
  tsm: typeof ts;
  checker: ts.TypeChecker;
  /** True for a file whose declarations are not the project's own: the platform's, or a skipped package's. */
  skipped: (file: string) => boolean;
}

const IN_PACKAGES = /[\\/]node_modules[\\/]/;

type Defined = ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration;

const definedBy = (tsm: typeof ts, node: ts.Declaration | undefined): node is Defined =>
  !!node && (tsm.isInterfaceDeclaration(node) || tsm.isTypeAliasDeclaration(node) || tsm.isEnumDeclaration(node));

/**
 * The definitions found so far by name, and the declaration each name was found as: null once a name has meant two
 * types, which then gets no definition, since a reader sees only the name.
 */
export interface TypeDefs {
  defs: Map<string, ApiTypeDef>;
  seen: Map<string, Defined | null>;
  /** The files the definitions were printed from. */
  files: Set<string>;
}

export const createTypeDefs = (): TypeDefs => ({ defs: new Map(), seen: new Map(), files: new Set() });

/**
 * Adds to `into` the definition of each type `text` refers to that, seen from `from`, is an interface, type alias or
 * enum the project declares: the declaration as written, comments and `export` dropped, and its doc summary.
 */
export function addTypeDefs(reading: TypeDefReading, from: ts.Node, text: string, into: TypeDefs): void {
  const { tsm, checker } = reading;
  const names = [...referencedNames(tsm, text)].filter((name) => into.seen.get(name) !== null);
  if (names.length === 0) return;
  const scope = checker.getSymbolsInScope(from, tsm.SymbolFlags.Type | tsm.SymbolFlags.Alias);
  for (const name of names) {
    let symbol = scope.find((s) => s.getName() === name);
    if (symbol && symbol.flags & tsm.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    if (symbol) addTypeDef(reading, symbol, into, name);
  }
}

/** The names a type's text refers to as types: the head of each reference, never a property key or a string. */
function referencedNames(tsm: typeof ts, text: string): Set<string> {
  const file = tsm.createSourceFile('type.ts', `type T = ${text};`, tsm.ScriptTarget.Latest, false, tsm.ScriptKind.TS);
  const names = new Set<string>();
  const add = (name: ts.EntityName | ts.Expression) => {
    while (tsm.isQualifiedName(name) || tsm.isPropertyAccessExpression(name)) name = tsm.isQualifiedName(name) ? name.left : name.expression;
    if (tsm.isIdentifier(name)) names.add(name.text);
  };
  const visit = (node: ts.Node): void => {
    if (tsm.isTypeReferenceNode(node)) add(node.typeName);
    else if (tsm.isExpressionWithTypeArguments(node)) add(node.expression);
    tsm.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

/**
 * Adds `symbol`'s definition to `into` under `name`, where it is a type the project declares: the name the text
 * writes, which an aliased import makes differ from the symbol's own.
 */
export function addTypeDef(reading: TypeDefReading, symbol: ts.Symbol, into: TypeDefs, name = symbol.getName()): void {
  const { tsm, checker } = reading;
  const declarations = (symbol.getDeclarations() ?? []).filter((d) => definedBy(tsm, d));
  const declaration = declarations[0];
  if (!declaration) return;
  const seen = into.seen.get(name);
  if (seen !== undefined) {
    if (seen !== declaration) {
      into.seen.set(name, null);
      into.defs.delete(name);
    }
    return;
  }
  into.seen.set(name, declaration);
  const files = declarations.map((d) => d.getSourceFile());
  if (files.some(({ fileName }) => reading.skipped(fileName) || IN_PACKAGES.test(fileName))) return;
  const printer = tsm.createPrinter({ removeComments: true });
  const printed = declarations.map((d) =>
    printer.printNode(tsm.EmitHint.Unspecified, d, d.getSourceFile()).replace(/^(export\s+)?(default\s+)?(declare\s+)?/, ''),
  );
  const def: ApiTypeDef = { text: printed.join('\n') };
  const description = tsm.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
  if (description) def.description = description;
  into.defs.set(name, def);
  for (const { fileName } of files) into.files.add(fileName);
}
