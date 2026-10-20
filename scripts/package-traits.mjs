/**
 * What each published package needs from its host. The README's package
 * table is drawn from this.
 *
 * React and the DOM are measured, not declared: each package's main entry is
 * typechecked with no `lib.dom`, and with no ambient types but Node's. If
 * `@types/react` or a .tsx file is in that program, the entry's imports reach
 * React; if it
 * fails to typecheck, they reach the DOM. Only the main entry counts, so a
 * package keeping React behind `./react` reads as React-optional.
 *
 * What a typecheck cannot tell apart is declared in the manifest's
 * `weasel.needs`: `webgl2` and `webaudio`. Both APIs live in `lib.dom`, and
 * only the package that draws or plays needs the device.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import { contentHashes, readCached, writeCached } from './lib/input-cache.mjs';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEVICES = ['webgl2', 'webaudio'];

const run = promisify(execFile);
const cache = join(repoRoot, 'node_modules/.cache/package-traits');

export function readManifests(root = repoRoot) {
  const dir = join(root, 'packages');
  const out = new Map();
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, 'package.json');
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    if (!pkg.private) out.set(name, pkg);
  }
  return out;
}

const rootPaths = () =>
  ts.parseConfigFileTextToJson('tsconfig.json', readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')).config
    .compilerOptions.paths;

// What a probe reads besides the repo files its program lists: the lockfile stands for node_modules.
const PROBE_INPUTS = ['tsconfig.json', 'package-lock.json', 'scripts/package-traits.mjs'].map((p) => join(repoRoot, p));

/**
 * Typechecks one entry, named by its import specifier, without the DOM. The result is kept beside
 * its config and reused while every file the program read is unchanged.
 */
async function probe(spec, paths, hashOf) {
  const entry = paths[spec]?.[0];
  if (!entry) throw new Error(`no paths entry for ${spec} in tsconfig.json`);
  const up = (p) => join('../../..', p);
  const config = join(cache, `${spec.replace(/^@weasel-js\//, '').replaceAll('/', '--')}.json`);
  const stored = config.replace(/\.json$/, '.result');
  const cached = readCached(stored, hashOf);
  if (cached) return cached;
  writeFileSync(
    config,
    JSON.stringify({
      extends: up('tsconfig.json'),
      compilerOptions: {
        lib: ['ES2023'],
        types: ['node'],
        noEmit: true,
        incremental: false,
        declaration: false,
        declarationMap: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        // `react-jsx` would add a jsx-runtime import to every module, JSX or
        // not; a .tsx file in the program is what counts instead.
        jsx: 'preserve',
        // `paths` resolve against the config that sets them, which is this one.
        paths: {
          ...Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, v.map(up)])),
          'opentype.js': ['./opentype-stub.d.ts'],
        },
      },
      files: [up(entry)],
      include: [],
    }),
  );
  let out;
  try {
    out = (await run(join(repoRoot, 'node_modules/.bin/tsc'), ['-p', config, '--listFiles'], { cwd: repoRoot, maxBuffer: 1 << 26 })).stdout;
  } catch (e) {
    out = String(e.stdout);
  }
  const lines = out.split('\n');
  if (lines.some((l) => l.endsWith('/lib.dom.d.ts'))) {
    throw new Error(`${spec}: lib.dom.d.ts was pulled in by a \`/// <reference lib="dom" />\` in some dependency's types; stub that module in package-traits.mjs`);
  }
  const result = {
    react: lines.some((l) => l.includes('/node_modules/@types/react/') || (l.endsWith('.tsx') && !l.includes('/node_modules/'))),
    dom: lines.some((l) => /error TS/.test(l)),
  };
  const read = lines.filter((l) => l.startsWith('/') && !l.includes('/node_modules/'));
  writeCached(stored, [...read, ...PROBE_INPUTS], result, hashOf);
  return result;
}

/**
 * `{ react, dom }` for each specifier, typechecked as `probe` does.
 * `onProbe(done, total, spec)` reports progress.
 */
export async function probeEntries(specs, { onProbe } = {}) {
  mkdirSync(cache, { recursive: true });
  // @types/opentype.js opens with `/// <reference lib="dom" />`, which would
  // hand every program importing font the whole DOM. What opentype.js does
  // inside itself is not ours to measure, so the probe sees it untyped.
  writeFileSync(join(cache, 'opentype-stub.d.ts'), 'declare const opentype: any;\nexport = opentype;\n');
  const paths = rootPaths();
  const hashOf = contentHashes();
  const probes = new Map();
  const queue = [...specs];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(cpus().length - 1, 6)) }, async () => {
      while (queue.length) {
        const spec = queue.shift();
        probes.set(spec, await probe(spec, paths, hashOf));
        onProbe?.(probes.size, specs.length, spec);
      }
    }),
  );
  return probes;
}

/**
 * Traits for every published package:
 * `{ react: 'needs'|'optional'|'none', dom, webgl2, webaudio, standalone }`.
 * `onProbe(done, total, name)` reports progress; a full run takes about half
 * a minute.
 */
export async function packageTraits({ onProbe } = {}) {
  const manifests = readManifests();
  const names = [...manifests.keys()];
  const probes = await probeEntries(names.map((n) => `@weasel-js/${n}`), {
    onProbe: onProbe && ((done, total, spec) => onProbe(done, total, spec.slice('@weasel-js/'.length))),
  });
  const out = new Map();
  for (const name of names) {
    const pkg = manifests.get(name);
    const needs = pkg.weasel?.needs ?? [];
    for (const n of needs) if (!DEVICES.includes(n)) throw new Error(`${name}: unknown weasel.needs entry "${n}"`);
    const p = probes.get(`@weasel-js/${name}`);
    out.set(name, {
      react: p.react ? 'needs' : pkg.exports?.['./react'] ? 'optional' : 'none',
      dom: p.dom,
      webgl2: needs.includes('webgl2'),
      webaudio: needs.includes('webaudio'),
      standalone: !Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).some((d) => d.startsWith('@weasel-js/')),
    });
  }
  return out;
}
