// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFile } from './ast.ts';

/** What `file` imports at run time, type-only imports aside. */
const specifiers = (file: string): string[] =>
  parseFile(readFileSync(file, 'utf8'), file).body.flatMap((stmt) =>
    (stmt.type === 'ImportDeclaration' && stmt.importKind !== 'type') ||
    ((stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportAllDeclaration') && stmt.source && stmt.exportKind !== 'type')
      ? [stmt.source!.value]
      : [],
  );

/** Every runtime import of a workspace package in the files `entry` reaches through relative imports. */
function packageImports(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiers(file)) {
      if (spec.startsWith('.')) visit(resolve(dirname(file), /\.tsx?$/.test(spec) ? spec : `${spec}.ts`));
      else if (spec.startsWith('@weasel-js/')) found.push(`${file.slice(resolve(import.meta.dirname, '..').length + 1)}: ${spec}`);
    }
  };
  visit(entry);
  return found;
}

describe("forge's vite plugin source", () => {
  it('imports no workspace package, since configs load it before any package is built', () => {
    expect(packageImports(resolve(import.meta.dirname, 'index.ts'))).toEqual([]);
  });
});
