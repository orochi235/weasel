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
// Bundled with rolldown, which is what vite ships a consumer's production build
// with. Not esbuild: with code splitting on, it makes an entry import every
// module a dynamic import's chunk shares with the barrel's graph, used or not,
// so the lazily loaded mesh paint would read as statically imported.
import { rolldown } from 'rolldown';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Leaf symbols from unrelated corners of the kit, each a few hundred bytes at
// most. A regression to one chunk costs hundreds of kB, and one self-registering
// module kept alive costs kilobytes, so the budget sits just above them.
const BUDGET = 512;
const PROBES = ['asNodeId', 'unionBounds', 'screenToWorld', 'VERSION'];

// The mesh paint kind loads on demand: reaching the paint-kind registry must
// leave it in a dynamic chunk, while importing a mesh export must carry its
// registration, so an app using mesh code never draws a blank first frame.
const MESH_MODULE = /features\/meshPaint\//;
const MESH_REGISTRATION = /label:(`Mesh`|"Mesh")/;

/** Minified bytes, module ids and code of a one-line consumer entry plus every
 *  chunk it imports statically. */
async function measure(symbol) {
  const bundle = await rolldown({
    input: 'entry',
    cwd: repoRoot,
    external: [/^react($|\/)/, /^react-dom($|\/)/],
    plugins: [{
      name: 'probe-entry',
      resolveId: (id) => (id === 'entry' ? '\0entry' : null),
      load: (id) => (id === '\0entry'
        ? `import { ${symbol} } from '@weasel-js/core';\nconsole.log(${symbol});\n`
        : null),
    }],
    // Core's dist ships an index.css no JS imports; nothing here should load CSS.
    moduleTypes: { '.css': 'empty' },
    logLevel: 'silent',
  });
  const { output } = await bundle.generate({ format: 'es', minify: true });
  await bundle.close();
  const chunks = new Map(output.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]));
  const reached = new Set();
  const walk = (name) => {
    if (reached.has(name) || !chunks.has(name)) return;
    reached.add(name);
    for (const imp of chunks.get(name).imports) walk(imp);
  };
  walk([...chunks.values()].find((c) => c.isEntry).fileName);
  let bytes = 0;
  const modules = [];
  let code = '';
  for (const name of reached) {
    const chunk = chunks.get(name);
    bytes += Buffer.byteLength(chunk.code);
    modules.push(...chunk.moduleIds);
    code += chunk.code;
  }
  return { bytes, modules, code };
}

async function measureOrExplain(symbol) {
  try {
    return await measure(symbol);
  } catch (err) {
    console.error(`[treeshake] could not bundle \`${symbol}\` — run \`npm run build\` first.\n`);
    throw err;
  }
}

const failures = [];
const width = Math.max(...PROBES.map((p) => p.length), 'seedMeshPatch'.length);
const total = PROBES.length + 2;
for (const [i, symbol] of PROBES.entries()) {
  const { bytes } = await measureOrExplain(symbol);
  const verdict = bytes > BUDGET ? 'OVER' : 'ok';
  console.log(
    `[treeshake] ${i + 1}/${total}  ${symbol.padEnd(width)}  ${String(bytes).padStart(9)} B  ${verdict}`,
  );
  if (bytes > BUDGET) {
    failures.push(
      `importing ${symbol} from @weasel-js/core ships ${bytes} B, over the ${BUDGET} B budget.\n` +
        'Core\'s dist is no longer tree-shakeable. Check that packages/core/vite.config.ts still\n' +
        'emits one file per module (`preserveModules`), and that nothing registers itself at\n' +
        'module load where a one-symbol import can reach it.',
    );
  }
}

{
  const { bytes, modules } = await measureOrExplain('getPaintKind');
  const eager = modules.some((m) => MESH_MODULE.test(m));
  console.log(
    `[treeshake] ${total - 1}/${total}  ${'getPaintKind'.padEnd(width)}  ${String(bytes).padStart(9)} B  ${eager ? 'MESH STATIC' : 'ok, mesh lazy'}`,
  );
  if (eager) {
    failures.push(
      'importing getPaintKind statically carries the mesh paint, which the paint-kind\n' +
        'registry is meant to load on demand.',
    );
  }
}

{
  const { bytes, code } = await measureOrExplain('seedMeshPatch');
  const registers = MESH_REGISTRATION.test(code);
  console.log(
    `[treeshake] ${total}/${total}  ${'seedMeshPatch'.padEnd(width)}  ${String(bytes).padStart(9)} B  ${registers ? 'ok, registers' : 'NO REGISTRATION'}`,
  );
  if (!registers) {
    failures.push(
      'importing seedMeshPatch no longer carries the mesh kind\'s registration, so an app\n' +
        'using mesh code would draw nothing for a mesh fill until it loads.',
    );
  }
}

if (failures.length) {
  console.error(`\n[treeshake] ${failures.join('\n\n[treeshake] ')}`);
  process.exit(1);
}
