import type ts from 'typescript';

/** The local name standing in for a component a meta does not name: its title's last segment, spaces dropped. */
export const titleStandIn = (title: string): string | undefined => title.split('/').pop()?.replace(/\s+/g, '');

/** A story file's component: its props type, null when it takes none, and the declaration its symbol names. */
export interface FoundComponent {
  props: ts.Type | null;
  declaration: ts.Declaration | undefined;
}

/** The component a story file's default export names as `component`, wherever it is declared: what its args feed. */
export function metaComponentOf(tsm: typeof ts, checker: ts.TypeChecker, source: ts.SourceFile): FoundComponent | null {
  const exported = defaultOf(checker, source);
  if (!exported) return null;
  const meta = checker.getTypeOfSymbolAtLocation(resolved(tsm, checker, exported), source);
  const named = meta.getProperty('component');
  const symbol = named && assigned(tsm, checker, resolved(tsm, checker, exported));
  return named ? found(checker, source, symbol ?? named) : null;
}

/**
 * The component a story file documents, as the dependency graph picks it: the one its default export names as
 * `component`, else the import named `fallback`. A native `meta()` names none, and neither a wrapper the story file
 * declares nor a dependency's component is one the graph can key, so the title's last segment stands in for either.
 * Null when neither names a component the project declares.
 */
export function componentOf(
  tsm: typeof ts,
  checker: ts.TypeChecker,
  source: ts.SourceFile,
  fallback: string | undefined,
): FoundComponent | null {
  const exported = defaultOf(checker, source);
  if (!exported) return null;
  const outside = (symbol: ts.Symbol | undefined): boolean =>
    !symbol ||
    (symbol.getDeclarations() ?? []).some((declaration) => {
      const file = declaration.getSourceFile();
      return file === source || file.fileName.split(/[\\/]/).includes('node_modules');
    });
  let symbol = assigned(tsm, checker, resolved(tsm, checker, exported));
  if (outside(symbol)) symbol = fallback ? importNamed(tsm, checker, source, fallback) : undefined;
  return symbol && !outside(symbol) ? found(checker, source, symbol) : null;
}

const defaultOf = (checker: ts.TypeChecker, source: ts.SourceFile): ts.Symbol | undefined => {
  const module = checker.getSymbolAtLocation(source);
  return module && checker.tryGetMemberInModuleExports('default', module);
};

function found(checker: ts.TypeChecker, source: ts.SourceFile, symbol: ts.Symbol): FoundComponent | null {
  // The value's own type: a meta typed `Meta` alone would otherwise give a props type of `any`.
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, source));
  const declaration = symbol.getDeclarations()?.[0];
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
