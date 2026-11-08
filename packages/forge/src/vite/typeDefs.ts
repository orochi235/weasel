import type ts from 'typescript';
import type { ApiTypeDef } from '../story/api.ts';

/** What reading a type's definition needs. */
export interface TypeDefReading {
  tsm: typeof ts;
  checker: ts.TypeChecker;
  /** True for a file whose declarations are not the project's own: the platform's, or a skipped package's. */
  skipped: (file: string) => boolean;
}

const NAME = /[A-Za-z_$][\w$]*/g;
const IN_PACKAGES = /[\\/]node_modules[\\/]/;

type Defined = ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration;

const definedBy = (tsm: typeof ts, node: ts.Declaration | undefined): node is Defined =>
  !!node && (tsm.isInterfaceDeclaration(node) || tsm.isTypeAliasDeclaration(node) || tsm.isEnumDeclaration(node));

/**
 * Adds to `into` the definition of each name in `text` that, seen from `from`, is an interface, type alias or enum
 * the project declares: the declaration as written, comments and `export` dropped, and its doc summary.
 */
export function addTypeDefs(reading: TypeDefReading, from: ts.Node, text: string, into: Map<string, ApiTypeDef>): void {
  const { tsm, checker } = reading;
  const names = new Set(text.match(NAME) ?? []);
  for (const name of into.keys()) names.delete(name);
  if (names.size === 0) return;
  const scope = checker.getSymbolsInScope(from, tsm.SymbolFlags.Type | tsm.SymbolFlags.Alias);
  for (const name of names) {
    let symbol = scope.find((s) => s.getName() === name);
    if (symbol && symbol.flags & tsm.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    if (symbol) addTypeDef(reading, symbol, into);
  }
}

/** Adds `symbol`'s definition to `into` under its name, where it is a type the project declares. */
export function addTypeDef(reading: TypeDefReading, symbol: ts.Symbol, into: Map<string, ApiTypeDef>): void {
  const { tsm, checker } = reading;
  const name = symbol.getName();
  if (into.has(name)) return;
  const declaration = symbol.getDeclarations()?.find((d) => definedBy(tsm, d));
  if (!definedBy(tsm, declaration)) return;
  const file = declaration.getSourceFile();
  if (reading.skipped(file.fileName) || IN_PACKAGES.test(file.fileName)) return;
  const printer = tsm.createPrinter({ removeComments: true });
  const def: ApiTypeDef = {
    text: printer.printNode(tsm.EmitHint.Unspecified, declaration, file).replace(/^(export\s+)?(declare\s+)?/, ''),
  };
  const description = tsm.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
  if (description) def.description = description;
  into.set(name, def);
}
