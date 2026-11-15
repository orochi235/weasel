#!/usr/bin/env node
// `node ../../scripts/dts-extensions.mjs dist`, after a package's declaration-only `tsc`: writes the
// `.js` extension into every relative specifier of the emitted `.d.ts` files.
//
// The repo's source imports without extensions under `moduleResolution: Bundler`, and tsc copies
// specifiers into declarations as written. A consumer on `NodeNext` cannot resolve `./Button`
// (TS2834), so every type behind it reads as `any` under `skipLibCheck`. `./Button.js` resolves in
// both modes. A specifier naming a directory becomes `./dir/index.js`. A side-effect import of an
// asset (`import './x.css'`) carries no types, names a file vite folded into `style.css`, and fails a
// consumer under `noUncheckedSideEffectImports`, so it is dropped.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ASSET = /\.(?![cm]?[jt]sx?$)\w+$/;

/** Every module specifier `sourceFile` names, as `[start, end, text]` of the literal's contents, and
 *  each side-effect asset import as `[start, end, null]` of the whole statement. */
function specifierRanges(sourceFile) {
  const out = [];
  const take = (literal) => {
    if (literal && ts.isStringLiteral(literal)) out.push([literal.getStart(sourceFile) + 1, literal.end - 1, literal.text]);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && !node.importClause && ASSET.test(node.moduleSpecifier.text)) {
      out.push([node.getStart(sourceFile), node.end, null]);
      return;
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) take(node.moduleSpecifier);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) take(node.argument.literal);
    else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) take(node.name);
    else if (ts.isExternalModuleReference(node)) take(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

/** What `spec`, written in `file`, becomes: `null` to leave it, `undefined` when nothing answers it. */
function withExtension(file, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  if (/\.[cm]?js$/.test(spec)) return null;
  const base = resolve(dirname(file), spec);
  if (existsSync(`${base}.d.ts`)) return `${spec}.js`;
  if (existsSync(join(base, 'index.d.ts'))) return `${spec.replace(/\/$/, '')}/index.js`;
  // An asset (`./x.css`) has no declaration to name; a `.ts` extension would have to be rewritten.
  return ASSET.test(spec) ? null : undefined;
}

/** Rewrites one declaration's text; returns it with the specifiers nothing answered. */
export function rewriteDeclaration(file, text) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const unresolved = [];
  let result = text;
  for (const [start, end, spec] of specifierRanges(sourceFile).sort((a, b) => b[0] - a[0])) {
    const next = spec === null ? '' : withExtension(file, spec);
    if (next === undefined) unresolved.push(spec);
    else if (next !== null) result = result.slice(0, start) + next + result.slice(end);
  }
  return { text: result, unresolved };
}

function declarations(dir) {
  return readdirSync(dir, { recursive: true })
    .map((f) => join(dir, f))
    .filter((f) => f.endsWith('.d.ts') && statSync(f).isFile());
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = resolve(process.argv[2] ?? 'dist');
  const problems = [];
  let changed = 0;
  for (const file of declarations(dist)) {
    const before = readFileSync(file, 'utf8');
    const { text, unresolved } = rewriteDeclaration(file, before);
    for (const spec of unresolved) problems.push(`${relative(process.cwd(), file)}: ${spec}`);
    if (text !== before) {
      writeFileSync(file, text);
      changed++;
    }
  }
  if (problems.length) {
    console.error(`dts-extensions: relative specifiers that name no emitted declaration:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`dts-extensions: ${changed} declaration file(s) in ${relative(process.cwd(), dist) || '.'} rewritten.`);
}
