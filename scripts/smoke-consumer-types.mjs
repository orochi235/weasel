#!/usr/bin/env node
// Every public declaration of the packed packages, typechecked by a consumer on `NodeNext` and on
// `Bundler` resolution with library checking on. Phase 4 of smoke-consumer-bundle.mjs runs bundler
// resolution under `skipLibCheck`, which reads a declaration that names an unresolvable module as
// `any` and passes; this reports the TS2834 in the declaration itself, and each assertion below
// fails if the type it names has gone `any`. Errors inside a third-party package's declarations are
// counted and not gated on: they are that package's to fix, and a consumer meets them either way.
//
//   node scripts/smoke-consumer-types.mjs              # every package, packed into a temp tree
//   node scripts/smoke-consumer-types.mjs ui hud       # these and their @weasel-js dependencies
//
// smoke-consumer-bundle.mjs calls `smokeDeclarations` on the tree it has already packed.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { packInto } from './lib/pack-tree.mjs';

/**
 * Types that must reject an object they have no property for, one per declaration pipeline: ui,
 * ui-canvas, hud, devtools, measure and prefs-editor emit with a declaration-only `tsc`, labkit with its own
 * rollup-plugin-dts build, the rest with tsup. Through a subpath where the package has one.
 */
const REJECTS = [
  ['@weasel-js/ui/components/Button', 'ButtonProps'],
  ['@weasel-js/ui', 'ButtonProps'],
  ['@weasel-js/ui-canvas/components/Rulers', 'RulersProps'],
  ['@weasel-js/hud', 'ButtonOptions'],
  ['@weasel-js/devtools', 'DevtoolsPanelProps'],
  ['@weasel-js/measure', 'MeasureReadoutProps'],
  ['@weasel-js/prefs-editor', 'PrefSchemaEditorProps'],
  ['@weasel-js/labkit/primitives', 'JobProgressProps'],
  ['@weasel-js/core', 'SceneCanvasProps<unknown, string, unknown>'],
];

const MODES = [
  { name: 'NodeNext', module: 'NodeNext', moduleResolution: 'NodeNext' },
  { name: 'Bundler', module: 'ESNext', moduleResolution: 'Bundler' },
];

/** Each subpath `manifest` exports with a target `pick` chooses from its conditions, a wildcard expanded
 *  against the extracted package's files, as `[specifier, file]`. */
export function exportSubpaths(manifest, pkgDir, pick) {
  const out = [];
  for (const [key, target] of Object.entries(manifest.exports ?? { '.': { types: manifest.types, import: manifest.main } })) {
    const chosen = pick(target);
    if (!chosen) continue;
    const subpath = (rest) => `${manifest.name}${rest.slice(1)}`;
    if (!key.includes('*')) {
      out.push([subpath(key), join(pkgDir, chosen)]);
      continue;
    }
    const [head, tail] = chosen.split('*');
    const dir = head.slice(0, head.lastIndexOf('/') + 1);
    const lead = head.slice(dir.length);
    if (!existsSync(join(pkgDir, dir))) continue;
    for (const name of readdirSync(join(pkgDir, dir))) {
      if (!name.startsWith(lead)) continue;
      const rest = name.slice(lead.length);
      const star = rest.endsWith(tail) ? rest.slice(0, -tail.length) : rest;
      const file = join(pkgDir, `${head}${star}${tail}`);
      if (existsSync(file)) out.push([subpath(key.replace('*', star)), file]);
    }
  }
  return out;
}

/** Each subpath `manifest` exports with types, as `[specifier, declaration file]`. */
export const typedSubpaths = (manifest, pkgDir) =>
  exportSubpaths(manifest, pkgDir, (target) => (typeof target === 'object' && target ? target.types : null));

/** The JavaScript file an export's target loads for `import`, or null for a stylesheet, JSON, or types alone. */
export function importTarget(target) {
  if (typeof target === 'string') return /\.m?js$/.test(target) ? target : null;
  if (!target || typeof target !== 'object') return null;
  const chosen = target.import ?? target.default;
  return typeof chosen === 'string' ? importTarget(chosen) : importTarget(chosen ?? null);
}

/** Links each third-party dependency the packed packages declare, and its `@types`, from the repo's install. */
async function linkThirdParty(repoRoot, manifests, nodeModules) {
  const deps = new Set();
  for (const m of manifests) {
    for (const dep of Object.keys({ ...m.dependencies, ...m.peerDependencies })) {
      if (!dep.startsWith('@weasel-js/')) deps.add(dep).add(`@types/${dep.replace(/^@(.*)\//, '$1__')}`);
    }
  }
  for (const dep of deps) {
    const from = join(repoRoot, 'node_modules', dep);
    const at = join(nodeModules, dep);
    if (!existsSync(from) || existsSync(at)) continue;
    await mkdir(dirname(at), { recursive: true });
    await symlink(from, at, 'dir');
  }
}

/**
 * Typechecks a consumer of every typed subpath in `manifests`, once per resolution mode.
 * @param {{ repoRoot: string, workDir: string, nodeModules: string, manifests: object[], fail: (msg: string, detail?: string) => never }} ctx
 */
export async function smokeDeclarations({ repoRoot, workDir, nodeModules, manifests, fail }) {
  await linkThirdParty(repoRoot, manifests, nodeModules);
  const subpaths = manifests.flatMap((m) => typedSubpaths(m, join(nodeModules, ...m.name.split('/'))));
  const packed = new Set(manifests.map((m) => m.name));
  const rejects = REJECTS.filter(([spec]) => packed.has(spec.split('/').slice(0, 2).join('/')));

  const dir = join(workDir, 'declarations');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'declarations-consumer', private: true, type: 'module' }));
  await writeFile(
    join(dir, 'consumer.ts'),
    (await Promise.all(subpaths.map(async ([spec, file], i) =>
      // A subpath of ambient declarations (icons-plugin's `virtual`) is referenced, not imported.
      ts.isExternalModule(ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest))
        ? `export type _P${i} = typeof import('${spec}');\n`
        : `/// <reference types="${spec}" />\n`)))
      .sort((a, b) => Number(b.startsWith('///')) - Number(a.startsWith('///')))
      .join('') +
      rejects
        .map(([spec, type], i) =>
          `import type { ${type.replace(/<.*/, '')} as _R${i} } from '${spec}';\n` +
          `// @ts-expect-error ${type} takes no such property, unless it has gone \`any\`\n` +
          `export const _r${i}: _R${i}${type.includes('<') ? type.slice(type.indexOf('<')) : ''} = { notAProperty: true };\n`)
        .join(''),
  );

  const tsc = join(repoRoot, 'node_modules', '.bin', 'tsc');
  for (const mode of MODES) {
    const config = `tsconfig.${mode.name.toLowerCase()}.json`;
    await writeFile(
      join(dir, config),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          module: mode.module,
          moduleResolution: mode.moduleResolution,
          target: 'es2022',
          lib: ['esnext', 'dom', 'dom.iterable'],
          jsx: 'react-jsx',
          types: [],
        },
        files: ['consumer.ts'],
      }),
    );
    const { ours, theirs } = diagnostics(tsc, config, dir);
    if (ours.length) {
      fail(
        `consumer declarations FAILED under ${mode.name} resolution with library checking on:`,
        ours.join('\n') +
          '\n[smoke] An error inside a package\'s .d.ts is a declaration a consumer on this resolution\n' +
          'cannot read (TS2834: a relative specifier with no extension; see scripts/dts-extensions.mjs).\n' +
          'TS2578 on an assertion in consumer.ts means the type it names has resolved to `any`.',
      );
    }
    console.log(
      `[smoke] declarations OK under ${mode.name}: ${subpaths.length} subpaths, ${rejects.length} rejecting assertions` +
        (theirs.length ? `; ${theirs.length} error(s) in third-party declarations, not gated:\n  ${theirs.map((d) => d.split('\n')[0]).join('\n  ')}` : '.'),
    );
  }
}

/** tsc's errors for `config`, split into the consumer's and weasel's own (`ours`) and other packages' (`theirs`). */
export function diagnostics(tsc, config, cwd) {
  let output = '';
  try {
    execFileSync(tsc, ['-p', config, '--pretty', 'false'], { cwd, stdio: 'pipe' });
  } catch (err) {
    output = String(err.stdout ?? '') + String(err.stderr ?? '');
  }
  const all = [];
  for (const line of output.split('\n')) {
    if (/^\s/.test(line) && all.length) all[all.length - 1] += `\n${line}`;
    else if (line.trim()) all.push(line);
  }
  const ownFile = (d) => {
    const file = /^(.+?)\(\d+,\d+\): /.exec(d)?.[1];
    return !file || !file.includes('node_modules/') || file.includes('node_modules/@weasel-js/');
  };
  return { ours: all.filter(ownFile), theirs: all.filter((d) => !ownFile(d)) };
}

/** `dirs` and every workspace package their manifests reach, as directory names under `packages/`. */
export async function closure(repoRoot, dirs) {
  const byName = new Map();
  for (const dir of readdirSync(join(repoRoot, 'packages'))) {
    const file = join(repoRoot, 'packages', dir, 'package.json');
    if (existsSync(file)) byName.set(JSON.parse(await readFile(file, 'utf8')).name, { dir, file });
  }
  const all = [...byName.values()].map((p) => p.dir);
  if (dirs.length === 0) return all.sort();
  const seen = new Set();
  const visit = async (name) => {
    const entry = byName.get(name);
    if (!entry || seen.has(entry.dir)) return;
    seen.add(entry.dir);
    const m = JSON.parse(await readFile(entry.file, 'utf8'));
    for (const dep of Object.keys({ ...m.dependencies, ...m.peerDependencies })) await visit(dep);
  };
  for (const dir of dirs) await visit(`@weasel-js/${dir}`);
  return [...seen].sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const workDir = await mkdtemp(join(tmpdir(), 'weasel-declarations-'));
  const nodeModules = join(workDir, 'node_modules');
  const fail = (msg, detail) => {
    console.error(`[smoke] ${msg}\n`);
    if (detail) console.error(detail);
    console.error(`[smoke] consumer left at ${workDir}`);
    process.exit(1);
  };
  const dirs = await closure(repoRoot, process.argv.slice(2));
  const manifests = await packInto(repoRoot, dirs, nodeModules, join(workDir, 'tarballs'));
  console.log(`[smoke] packed ${dirs.length} packages into ${workDir}.`);
  await smokeDeclarations({ repoRoot, workDir, nodeModules, manifests, fail });
  await rm(workDir, { recursive: true, force: true });
}
