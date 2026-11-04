/**
 * Is the dev server serving your edit? — a three-layer staleness probe.
 *
 *   node scripts/is-it-stale.mjs <module-path> <needle> [origin]
 *   node scripts/is-it-stale.mjs packages/renderer/src/draw.ts u_tileOrigin
 *
 * "My change isn't taking effect" is three different failures:
 *
 *   DISK    the file on disk contains <needle>
 *   SERVER  the dev server's transform output for that module contains it
 *   BUNDLE  no pre-bundled copy in any Vite cache dir (node_modules/.vite, .vite-draw, …) holds an old version of the module
 *
 * DISK yes + SERVER no  → the server's transform cache is stale. Restart it,
 *                         or `rm -rf node_modules/.vite`.
 * SERVER yes + page old → the server is fine; the page is. Hard-reload, and
 *                         suspect a module-level singleton that survived HMR
 *                         (a renderer, a registry, a cache built at import).
 * BUNDLE stale          → a pre-bundled copy predates the edit, and the page
 *                         imports it. Restart the server that owns that cache dir.
 *
 * Exit code is 1 when any layer disagrees, so it drops into a script.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ports from './dev-ports.json' with { type: 'json' };

const [modulePath, needle, origin = `http://localhost:${ports.site}`] = process.argv.slice(2);

if (!modulePath || !needle) {
  console.error('usage: node scripts/is-it-stale.mjs <module-path> <needle> [origin]');
  process.exit(2);
}

const results = [];

// ─── DISK ────────────────────────────────────────────────────────────────────
const abs = resolve(process.cwd(), modulePath);
const onDisk = existsSync(abs) && readFileSync(abs, 'utf8').includes(needle);
results.push(['DISK', onDisk, abs]);

// ─── SERVER ──────────────────────────────────────────────────────────────────
// `/@fs/<absolute path>` is the form that reliably returns a module rather
// than the SPA fallback. A configured `base` still prefixes it, so try the
// origin as given and then walk its path prefix off.
const candidates = [];
{
  const u = new URL(origin);
  const segments = u.pathname.split('/').filter(Boolean);
  const fsPath = '@fs' + abs;
  for (let i = segments.length; i >= 0; i--) {
    candidates.push(new URL([...segments.slice(0, i), fsPath].join('/'), u.origin + '/').href);
  }
}

let served = false;
let reachable = false;
let serverNote = candidates[0];
for (const url of candidates) {
  try {
    const res = await fetch(url, { headers: { Accept: '*/*' } });
    if (!res.ok) continue;
    const body = await res.text();
    // A dev server with SPA fallback answers 200 with index.html for paths it
    // doesn't recognize; that is not "needle absent".
    if (/^\s*<!doctype html/i.test(body)) continue;
    reachable = true;
    served = body.includes(needle);
    serverNote = url;
    break;
  } catch (err) {
    serverNote = `${url} → ${err.message}`;
  }
}
if (!reachable) {
  serverNote = `no module served (HTML fallback or 404) at:\n           ${candidates.join('\n           ')}`;
}
// Unreachable is "couldn't measure", not "stale" — reporting a 404 as stale
// sends you restarting a server that was never the problem.
results.push(['SERVER', reachable ? served : null, serverNote]);

// ─── BUNDLE ──────────────────────────────────────────────────────────────────
// Each dev server pre-bundles the workspace into a cache dir of its own (`.vite`, `.vite-draw`, …), and a bundle
// marks every module it holds with a `// <repo path>` comment. A bundle holding the module without the needle is a
// stale copy, and the page runs it whatever the server serves at `/@fs`.
const nodeModules = resolve(process.cwd(), 'node_modules');
const cacheDirs = existsSync(nodeModules)
  ? readdirSync(nodeModules).filter((d) => /^\.vite(-[\w-]+)?$/.test(d) && existsSync(resolve(nodeModules, d, 'deps')))
  : [];
const marker = `// ${relative(process.cwd(), abs).split(sep).join('/')}`;
const holding = [];
for (const dir of cacheDirs) {
  const deps = resolve(nodeModules, dir, 'deps');
  for (const f of readdirSync(deps).filter((n) => n.endsWith('.js'))) {
    let body;
    try { body = readFileSync(resolve(deps, f), 'utf8'); } catch { continue; }
    if (body.includes(marker)) holding.push({ file: `${dir}/deps/${f}`, fresh: body.includes(needle) });
  }
}
const staleCopies = holding.filter((h) => !h.fresh);
const shadowed = staleCopies.length > 0;
const bundleNote = holding.length === 0
  ? `no pre-bundled copy in ${cacheDirs.length ? cacheDirs.map((d) => `node_modules/${d}/deps`).join(', ') : 'node_modules/.vite*/deps'}`
  : shadowed
    ? `pre-bundled copy without the needle: ${staleCopies.map((h) => h.file).join(', ')}`
    : `pre-bundled copies hold the edit: ${holding.map((h) => h.file).join(', ')}`;
results.push(['BUNDLE', !shadowed, bundleNote]);

for (const [layer, ok, note] of results) {
  const mark = ok === null ? '  ??  ' : ok ? '  ok  ' : ' STALE';
  console.log(`${mark}  ${layer.padEnd(7)} ${note}`);
}

if (!reachable) {
  console.log('\n→ Could not reach that module on the dev server, so staleness is');
  console.log('    unmeasured — not disproven. Check the path is repo-relative and');
  console.log('    that the origin includes any configured `base`.');
} else if (onDisk && !served) {
  console.log('\n→ Disk has it, server does not. The transform cache is stale:');
  console.log('    rm -rf node_modules/.vite && restart the dev server');
} else if (onDisk && served && shadowed) {
  console.log('\n→ Source is fresh but a pre-bundled copy predates it, and the page runs that copy.');
  console.log('    Restart the dev server that owns the cache dir named above.');
} else if (onDisk && served) {
  console.log('\n→ Server is serving your edit. If the page still misbehaves it is');
  console.log('    client-side: hard-reload, and look for a module-level singleton');
  console.log('    (renderer, registry, cache) that HMR re-imported but never rebuilt.');
}

process.exit(results.every(([, ok]) => ok) ? 0 : 1);
