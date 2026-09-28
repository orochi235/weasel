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
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Leaf symbols from unrelated corners of the kit. Each carries the modules
// package.json lists under `sideEffects` — the mesh paint, which registers
// itself (~19 kB) — and a few hundred bytes of its own. A regression to one
// chunk costs hundreds of kB, so the budget has room for honest growth without
// hiding that.
const BUDGET = 24 * 1024;
const PROBES = ['asNodeId', 'unionBounds', 'screenToWorld', 'VERSION'];

/** Minified bytes of a one-line consumer entry plus every chunk it imports statically. */
async function measure(symbol) {
  const result = await build({
    stdin: {
      contents: `import { ${symbol} } from '@weasel-js/core';\nconsole.log(${symbol});\n`,
      resolveDir: repoRoot,
      sourcefile: 'entry.js',
    },
    absWorkingDir: repoRoot,
    // The repo tsconfig maps @weasel-js/* to source; a consumer has no such paths.
    tsconfigRaw: {},
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    write: false,
    outdir: 'out',
    metafile: true,
    external: ['react', 'react-dom', 'react/*'],
    // Core's dist ships an index.css no JS imports; nothing here should load CSS.
    loader: { '.css': 'empty' },
    logLevel: 'error',
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find((k) => outputs[k].entryPoint);
  const reached = new Set();
  const walk = (key) => {
    if (reached.has(key)) return;
    reached.add(key);
    for (const imp of outputs[key].imports) {
      if (imp.kind === 'import-statement' && !imp.external) walk(imp.path);
    }
  };
  walk(entry);
  let bytes = 0;
  for (const key of reached) bytes += outputs[key].bytes;
  return bytes;
}

const over = [];
const width = Math.max(...PROBES.map((p) => p.length));
for (const [i, symbol] of PROBES.entries()) {
  let bytes;
  try {
    bytes = await measure(symbol);
  } catch (err) {
    console.error(`[treeshake] could not bundle \`${symbol}\` — run \`npm run build\` first.\n`);
    throw err;
  }
  const verdict = bytes > BUDGET ? 'OVER' : 'ok';
  console.log(
    `[treeshake] ${i + 1}/${PROBES.length}  ${symbol.padEnd(width)}  ${String(bytes).padStart(9)} B  ${verdict}`,
  );
  if (bytes > BUDGET) over.push(symbol);
}

if (over.length) {
  console.error(
    `\n[treeshake] importing ${over.join(', ')} from @weasel-js/core ships more than ${BUDGET} B.\n` +
      'Core\'s dist is no longer tree-shakeable. Check that packages/core/vite.config.ts still\n' +
      'emits one file per module (`preserveModules`), and that package.json\'s `sideEffects`\n' +
      'lists only modules that must run on import.',
  );
  process.exit(1);
}
