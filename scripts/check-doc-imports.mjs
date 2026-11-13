/**
 * Every name a doc's code block imports from `@weasel-js/*` is one that entry exports.
 *
 * A README or guide is what a consumer copies first, and nothing else compiles its examples: an
 * export that moves to another package or entry leaves the snippet naming it broken in silence.
 * Reads `packages/*\/README.md`, `packages/*\/docs/**\/*.md` and `docs/*.md`; resolves each
 * specifier through the generated `paths` in core's tsconfig, so an entry a package does not
 * export fails too.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Each `{ spec, name }` a markdown document's ts/tsx/js/jsx code blocks import by name from `@weasel-js/*`. */
export function namedImports(markdown) {
  const out = [];
  for (const block of markdown.matchAll(/```(?:tsx?|jsx?)\n([\s\S]*?)```/g)) {
    for (const m of block[1].matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@weasel-js\/[^'"]+)['"]/g)) {
      for (const part of m[1].split(',')) {
        const name = part.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.push({ spec: m[2], name });
      }
    }
  }
  return out;
}

function markdownFiles() {
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  };
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const readme = join(ROOT, 'packages', pkg, 'README.md');
    if (existsSync(readme)) files.push(readme);
    walk(join(ROOT, 'packages', pkg, 'docs'));
  }
  for (const f of readdirSync(join(ROOT, 'docs'))) if (f.endsWith('.md')) files.push(join(ROOT, 'docs', f));
  return files;
}

function main() {
  const ts = createRequire(join(ROOT, 'package.json'))('typescript');
  const coreDir = join(ROOT, 'packages/core');
  const config = ts.parseConfigFileTextToJson('tsconfig.json', readFileSync(join(coreDir, 'tsconfig.json'), 'utf8')).config;
  const paths = config.compilerOptions.paths;
  const entryOf = (spec) => {
    if (paths[spec]) return resolve(coreDir, paths[spec][0]);
    // A wildcard subpath (`@weasel-js/ui/components/*`) stands for one entry per name.
    for (const [key, [target]] of Object.entries(paths)) {
      const star = key.indexOf('*');
      if (star < 0) continue;
      const [head, tail] = [key.slice(0, star), key.slice(star + 1)];
      if (!spec.startsWith(head) || !spec.endsWith(tail) || spec.length < key.length) continue;
      const file = resolve(coreDir, target.replace('*', spec.slice(head.length, spec.length - tail.length)));
      if (existsSync(file) && statSync(file).isFile()) return file;
    }
    return null;
  };

  const uses = markdownFiles().flatMap((file) =>
    namedImports(readFileSync(file, 'utf8')).map((u) => ({ ...u, file: relative(ROOT, file) })));
  const entries = [...new Set(uses.map((u) => entryOf(u.spec)).filter(Boolean))];
  const options = {
    ...ts.convertCompilerOptionsFromJson({ ...config.compilerOptions, paths: undefined }, coreDir).options,
    paths, noEmit: true, skipLibCheck: true, types: [],
  };
  const program = ts.createProgram(entries, options);
  const checker = program.getTypeChecker();
  const exported = new Map(entries.map((e) => {
    const sf = program.getSourceFile(e);
    const mod = sf && checker.getSymbolAtLocation(sf);
    return [e, new Set(mod ? checker.getExportsOfModule(mod).map((s) => s.name) : [])];
  }));

  const problems = [];
  for (const u of uses) {
    const entry = entryOf(u.spec);
    if (!entry) problems.push(`${u.file}: ${u.spec} is no package entry (importing ${u.name})`);
    else if (!exported.get(entry).has(u.name)) problems.push(`${u.file}: ${u.spec} does not export ${u.name}`);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error("\nPoint each snippet at the entry that exports the name now, or at the name it was renamed to.");
    process.exit(1);
  }
  console.log(`${uses.length} named imports in docs, each exported where it is imported from`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
