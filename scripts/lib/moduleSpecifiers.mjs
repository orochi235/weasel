/**
 * What an emitted JavaScript module imports, read by parsing it.
 *
 * Built output carries code as text — a plugin's generated module, a template
 * the bundler kept — so a pattern over the file reads those strings as
 * imports. This walks the syntax tree and returns only real ones.
 */
import ts from 'typescript';

/** Every specifier of an `import`, `export … from`, or `import('…')`, in source order. */
export function moduleSpecifiers(source) {
  const file = ts.createSourceFile('module.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const out = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) out.push(node.moduleSpecifier.text);
      return;
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}
