import ts from 'typescript';

const FILE_TAG = /@packageDocumentation\b|@module\b/;

/**
 * Whether a file's opening doc comment is attached to an `export { … }` list.
 * TypeDoc reads the comment on that statement as the comment of every name in
 * the list that has none of its own, and a function never has one of its own
 * (its comment is its signature's), so a file's description becomes the
 * summary of each function the file re-exports. `@packageDocumentation` marks
 * it as the file's, and on an entry point makes it the entry's description.
 *
 * @param {string} fileName
 * @param {string} text
 */
export function headerOnExportList(fileName, text) {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false);
  const first = file.statements[0];
  if (!first || !ts.isExportDeclaration(first) || !first.exportClause || !ts.isNamedExports(first.exportClause)) {
    return false;
  }
  const docs = (ts.getLeadingCommentRanges(text, first.pos) ?? []).filter(
    (range) => range.kind === ts.SyntaxKind.MultiLineCommentTrivia && text.startsWith('/**', range.pos),
  );
  const attached = docs.at(-1);
  if (!attached || attached !== docs[0] || text.slice(0, attached.pos).trim() !== '') return false;
  return !FILE_TAG.test(text.slice(attached.pos, attached.end));
}
