import type ts from 'typescript';

/** The local name standing in for a component a meta does not name: its title's last segment, spaces dropped. */
export const titleStandIn = (title: string): string | undefined => title.split('/').pop()?.replace(/\s+/g, '');

/** A story file's component: its props type, null when it takes none, and the declaration its symbol names. */
export interface FoundComponent {
  props: ts.Type | null;
  declaration: ts.Declaration | undefined;
}

/**
 * The component a story file's default export names as `component`, else the import named `fallback`: a native
 * `meta()` names none, and the title's last segment stands in for it, as it does in the dependency graph.
 */
export function componentOf(
  tsm: typeof ts,
  checker: ts.TypeChecker,
  source: ts.SourceFile,
  fallback?: string,
): FoundComponent | null {
  const module = checker.getSymbolAtLocation(source);
  const exported = module && checker.tryGetMemberInModuleExports('default', module);
  if (!exported) return null;
  const meta = checker.getTypeOfSymbolAtLocation(resolved(tsm, checker, exported), source);
  const named = meta.getProperty('component');
  const symbol = named ? valueSymbol(tsm, checker, named) : fallback ? importNamed(tsm, checker, source, fallback) : undefined;
  if (!named && !symbol) return null;
  const type = checker.getNonNullableType(
    named ? checker.getTypeOfSymbolAtLocation(named, source) : checker.getTypeOfSymbolAtLocation(symbol!, source),
  );
  const declaration = symbol?.getDeclarations()?.[0];
  for (const part of type.isUnion() ? type.types : [type]) {
    const [call] = part.getCallSignatures();
    const [param] = call?.getParameters() ?? [];
    if (call) return { props: param ? checker.getTypeOfSymbolAtLocation(param, source) : null, declaration };
    const instance = part.getConstructSignatures()[0]?.getReturnType();
    const held = instance?.getProperty('props');
    if (held) return { props: checker.getTypeOfSymbolAtLocation(held, source), declaration };
  }
  return null;
}

const resolved = (tsm: typeof ts, checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol =>
  symbol.flags & tsm.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

/** The symbol the meta's `component` property is given, followed through imports. */
function valueSymbol(tsm: typeof ts, checker: ts.TypeChecker, property: ts.Symbol): ts.Symbol | undefined {
  const declaration = property.valueDeclaration;
  let value: ts.Symbol | undefined;
  if (declaration && tsm.isShorthandPropertyAssignment(declaration)) {
    value = checker.getShorthandAssignmentValueSymbol(declaration);
  } else if (declaration && tsm.isPropertyAssignment(declaration)) {
    value = checker.getSymbolAtLocation(declaration.initializer);
  }
  return value && resolved(tsm, checker, value);
}

function importNamed(tsm: typeof ts, checker: ts.TypeChecker, source: ts.SourceFile, name: string): ts.Symbol | undefined {
  for (const statement of source.statements) {
    if (!tsm.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    const names = [
      ...(clause?.name ? [clause.name] : []),
      ...(bindings && tsm.isNamedImports(bindings) ? bindings.elements.map((element) => element.name) : []),
    ];
    const found = names.find((id) => id.text === name);
    const symbol = found && checker.getSymbolAtLocation(found);
    if (symbol) return resolved(tsm, checker, symbol);
  }
  return undefined;
}
