#!/usr/bin/env node
// Fail when importing one small symbol from the built @weasel-js/core ships
// more than a small budget — i.e. when a consumer's bundler can no longer
// tree-shake core's dist. Run after `npm run build`: it reads the dist every
// workspace package resolves to, exactly as a consumer's bundler would.
//
// Core's source tree-shakes cleanly; what breaks is the packaging. A chunked
// build put every module in one file, where a single top-level registration
// call kept all of it alive, and `import { asNodeId }` shipped ~630 kB while
// every in-repo test (which resolves source) stayed green.
//
// Bundled twice: with rolldown, which is what vite ships a consumer's
// production build with, and with esbuild with code splitting on. esbuild makes
// an entry import every module a dynamic import's chunk shares with the
// barrel's graph, used or not, so a lazily loaded paint kind that imports any
// of core's own modules loads with every import of core.
import { rolldown } from 'rolldown';
import { build as esbuild } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Leaf symbols from unrelated corners of the kit, each a few hundred bytes at
// most. A regression to one chunk costs hundreds of kB, and one self-registering
// module kept alive costs kilobytes, so the budget sits just above them.
const BUDGET = 512;
const PROBES = ['asNodeId', 'unionBounds', 'screenToWorld', 'VERSION'];

// The mesh paint kind loads on demand: reaching the paint-kind registry must
// leave it in a dynamic chunk, while importing from `@weasel-js/core/mesh` must
// carry its registration, so an app using mesh code never draws a blank first
// frame.
const MESH_MODULE = /features\/meshPaint\//;
const MESH_REGISTRATION = /label:\s*(`Mesh`|"Mesh")/;

const entryCode = (symbol, from) => `import { ${symbol} } from '${from}';\nconsole.log(${symbol});\n`;
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/];

/** A one-line consumer entry plus every chunk it imports statically, as
 *  `{ bytes, modules, code }` over minified output. */
async function withRolldown(symbol, from) {
  const bundle = await rolldown({
    input: 'entry',
    cwd: repoRoot,
    external: EXTERNAL,
    plugins: [{
      name: 'probe-entry',
      resolveId: (id) => (id === 'entry' ? '\0entry' : null),
      load: (id) => (id === '\0entry' ? entryCode(symbol, from) : null),
    }],
    // Core's dist ships an index.css no JS imports; nothing here should load CSS.
    moduleTypes: { '.css': 'empty' },
    logLevel: 'silent',
  });
  const { output } = await bundle.generate({ format: 'es', minify: true });
  await bundle.close();
  const chunks = new Map(output.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]));
  return collect(
    [...chunks.values()].find((c) => c.isEntry).fileName,
    (name) => chunks.get(name)?.imports ?? [],
    (name) => ({ code: chunks.get(name).code, modules: chunks.get(name).moduleIds }),
  );
}

async function withEsbuild(symbol, from) {
  const outdir = join(repoRoot, 'treeshake-probe');
  const result = await esbuild({
    stdin: { contents: entryCode(symbol, from), resolveDir: repoRoot, loader: 'js' },
    absWorkingDir: repoRoot,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    write: false,
    metafile: true,
    outdir,
    external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    loader: { '.css': 'empty' },
    // The repo's tsconfig maps @weasel-js/* to source; a consumer resolves dist.
    tsconfigRaw: '{}',
    logLevel: 'silent',
  });
  const outputs = result.metafile.outputs;
  const files = new Map(result.outputFiles.map((f) => [f.path, f.text]));
  return collect(
    Object.keys(outputs).find((k) => outputs[k].entryPoint),
    (name) => outputs[name].imports.filter((i) => i.kind === 'import-statement').map((i) => i.path),
    (name) => ({ code: files.get(join(repoRoot, name)), modules: Object.keys(outputs[name].inputs) }),
  );
}

function collect(entry, importsOf, contentOf) {
  const reached = new Set();
  const walk = (name) => {
    if (reached.has(name)) return;
    reached.add(name);
    for (const imp of importsOf(name)) walk(imp);
  };
  walk(entry);
  let bytes = 0;
  const modules = [];
  let code = '';
  for (const name of reached) {
    const c = contentOf(name);
    bytes += Buffer.byteLength(c.code);
    modules.push(...c.modules);
    code += c.code;
  }
  if (modules.some((m) => m.includes('packages/core/src/'))) {
    throw new Error('the probe resolved core\'s source rather than its dist');
  }
  return { bytes, modules, code };
}

const BUNDLERS = { rolldown: withRolldown, esbuild: withEsbuild };

async function measureOrExplain(bundler, symbol, from) {
  try {
    return await BUNDLERS[bundler](symbol, from);
  } catch (err) {
    console.error(`[treeshake] could not bundle \`${symbol}\` with ${bundler} — run \`npm run build\` first.\n`);
    throw err;
  }
}

const failures = [];
const width = Math.max(...PROBES.map((p) => p.length), 'seedMeshPatch'.length);
const total = (PROBES.length + 2) * Object.keys(BUNDLERS).length;
let n = 0;
const line = (bundler, symbol, bytes, verdict) => console.log(
  `[treeshake] ${String(++n).padStart(2)}/${total}  ${bundler.padEnd(8)}  ${symbol.padEnd(width)}  ${String(bytes).padStart(9)} B  ${verdict}`,
);

for (const bundler of Object.keys(BUNDLERS)) {
  for (const symbol of PROBES) {
    const { bytes } = await measureOrExplain(bundler, symbol, '@weasel-js/core');
    line(bundler, symbol, bytes, bytes > BUDGET ? 'OVER' : 'ok');
    if (bytes > BUDGET) {
      failures.push(
        `${bundler}: importing ${symbol} from @weasel-js/core ships ${bytes} B, over the ${BUDGET} B budget.\n` +
          'Check that packages/core/vite.config.ts still emits one file per module\n' +
          '(`preserveModules`), that nothing registers itself at module load where a\n' +
          'one-symbol import can reach it, and that every lazily loaded paint kind is\n' +
          'still rebuilt as a self-contained file (`LAZY_KINDS`).',
      );
    }
  }

  {
    const { bytes, modules } = await measureOrExplain(bundler, 'getPaintKind', '@weasel-js/core');
    const eager = modules.some((m) => MESH_MODULE.test(m));
    line(bundler, 'getPaintKind', bytes, eager ? 'MESH STATIC' : 'ok, mesh lazy');
    if (eager) {
      failures.push(
        `${bundler}: importing getPaintKind statically carries the mesh paint, which the\n` +
          'paint-kind registry is meant to load on demand.',
      );
    }
  }

  {
    const { bytes, code } = await measureOrExplain(bundler, 'seedMeshPatch', '@weasel-js/core/mesh');
    const registers = MESH_REGISTRATION.test(code);
    line(bundler, 'seedMeshPatch', bytes, registers ? 'ok, registers' : 'NO REGISTRATION');
    if (!registers) {
      failures.push(
        `${bundler}: importing seedMeshPatch from @weasel-js/core/mesh no longer carries the\n` +
          'mesh kind\'s registration, so an app using mesh code would draw nothing for a mesh\n' +
          'fill until it loads.',
      );
    }
  }
}

if (failures.length) {
  console.error(`\n[treeshake] ${failures.join('\n\n[treeshake] ')}`);
  process.exit(1);
}
