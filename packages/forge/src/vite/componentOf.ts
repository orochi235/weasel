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
 * `meta()` names none, and a wrapper declared in the story file is not the component, so the title's last segment
 * stands in for either, as it does in the dependency graph.
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
  let named = meta.getProperty('component');
  let symbol = named && assigned(tsm, checker, resolved(tsm, checker, exported));
  // A wrapper the story file declares itself is the story's, not the component's, as the dependency graph reads it.
  const local = !symbol || symbol.getDeclarations()?.some((declaration) => declaration.getSourceFile() === source);
  const imported = local && fallback ? importNamed(tsm, checker, source, fallback) : undefined;
  if (imported) {
    named = undefined;
    symbol = imported;
  }
  if (!named && !symbol) return null;
  // The value's own type: a meta typed `Meta` alone would otherwise give a props type of `any`.
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol ?? named!, source));
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

/**
 * The symbol the meta object's `component` property is assigned, followed through imports: read from the object as
 * written, since a typed meta's property is declared by its type, not by the object.
 */
function assigned(tsm: typeof ts, checker: ts.TypeChecker, meta: ts.Symbol): ts.Symbol | undefined {
  const value = componentIn(tsm, checker, objectOf(tsm, meta), 0);
  return value && resolved(tsm, checker, value);
}

/** The object literal `symbol`'s declaration is initialized with, through calls and casts. */
function objectOf(tsm: typeof ts, symbol: ts.Symbol): ts.ObjectLiteralExpression | undefined {
  const declaration = symbol.getDeclarations()?.[0];
  let node: ts.Node | undefined =
    declaration && tsm.isVariableDeclaration(declaration)
      ? declaration.initializer
      : declaration && tsm.isExportAssignment(declaration)
        ? declaration.expression
        : undefined;
  while (node && !tsm.isObjectLiteralExpression(node)) {
    if (tsm.isCallExpression(node)) node = node.arguments[0];
    else if (
      tsm.isParenthesizedExpression(node) ||
      tsm.isAsExpression(node) ||
      tsm.isSatisfiesExpression(node) ||
      tsm.isTypeAssertionExpression(node) ||
      tsm.isNonNullExpression(node)
    ) {
      node = node.expression;
    } else node = undefined;
  }
  return node;
}

/**
 * The symbol `object` assigns `component`, as the object evaluates: the last property naming it, or what a spread
 * after it carries. A spread it cannot read is taken to set nothing, as the story indexer takes it.
 */
function componentIn(
  tsm: typeof ts,
  checker: ts.TypeChecker,
  object: ts.ObjectLiteralExpression | undefined,
  depth: number,
): ts.Symbol | undefined {
  if (!object || depth > 16) return undefined;
  for (const property of [...object.properties].reverse()) {
    if (tsm.isSpreadAssignment(property)) {
      const spread = checker.getSymbolAtLocation(property.expression);
      const found = spread && componentIn(tsm, checker, objectOf(tsm, resolved(tsm, checker, spread)), depth + 1);
      if (found) return found;
      continue;
    }
    if (keyName(tsm, property.name) !== 'component') continue;
    if (tsm.isShorthandPropertyAssignment(property)) return checker.getShorthandAssignmentValueSymbol(property);
    return tsm.isPropertyAssignment(property) ? checker.getSymbolAtLocation(property.initializer) : undefined;
  }
  return undefined;
}

const keyName = (tsm: typeof ts, name: ts.PropertyName | undefined): string | undefined => {
  const key = name && tsm.isComputedPropertyName(name) ? name.expression : name;
  return key && (tsm.isIdentifier(key) || tsm.isStringLiteral(key) || tsm.isNoSubstitutionTemplateLiteral(key)) ? key.text : undefined;
};

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
