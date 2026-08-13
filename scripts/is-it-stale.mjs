/**
 * Is the dev server serving your edit? — a three-layer staleness probe.
 *
 *   node scripts/is-it-stale.mjs <module-path> <needle> [origin]
 *   node scripts/is-it-stale.mjs packages/core/src/renderer/draw.ts u_tileOrigin
 *
 * "My change isn't taking effect" is three different failures wearing one
 * costume. This separates them:
 *
 *   DISK    the file on disk contains <needle>
 *   SERVER  the dev server's transform output for that module contains it
 *   BUNDLE  no pre-bundled copy in node_modules/.vite/deps shadows the module
 *
 * DISK yes + SERVER no  → the server's transform cache is stale. Restart it,
 *                         or `rm -rf node_modules/.vite`.
 * SERVER yes + page old → the server is fine; the page is. Hard-reload, and
 *                         suspect a module-level singleton that survived HMR
 *                         (a renderer, a registry, a cache built at import).
 * BUNDLE hit            → a pre-bundled copy is being imported instead of your
 *                         source. Alias or `optimizeDeps.exclude` the package.
 *
 * Exit code is 1 when any layer disagrees, so it drops into a script.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [modulePath, needle, origin = 'http://localhost:5173'] = process.argv.slice(2);

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
// Vite serves transformed source at the module's path. `?t=` busts its own
// HTTP cache without busting the transform cache — which is exactly the
// distinction we're trying to measure, so it is deliberately omitted.
// `/@fs/<absolute path>` is the form that reliably returns a module rather
// than the SPA fallback, and it sidesteps having to guess how the repo path
// maps onto the served path. A configured `base` still prefixes it, so try
// the origin as given and then walk its path prefix off.
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
    // doesn't recognize. Scoring that as "needle absent" reads as staleness
    // and sends you restarting a server that was fine.
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
// A pre-bundled dep shadowing your source is the failure that survives every
// restart, because the source is never consulted at all.
const depsDir = resolve(process.cwd(), 'node_modules/.vite/deps');
let shadowed = false;
let bundleNote = 'no node_modules/.vite/deps (nothing pre-bundled)';
if (existsSync(depsDir)) {
  const hits = readdirSync(depsDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => {
      try { return readFileSync(resolve(depsDir, f), 'utf8').includes(needle); }
      catch { return false; }
    });
  shadowed = hits.length > 0;
  bundleNote = shadowed
    ? `pre-bundled copy contains the needle: ${hits.join(', ')}`
    : `${readdirSync(depsDir).length} pre-bundled files, none contain it`;
}
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
  console.log('\n→ Source is fresh but a pre-bundled copy shadows it.');
  console.log('    Alias the package to source, or add it to optimizeDeps.exclude');
} else if (onDisk && served) {
  console.log('\n→ Server is serving your edit. If the page still misbehaves it is');
  console.log('    client-side: hard-reload, and look for a module-level singleton');
  console.log('    (renderer, registry, cache) that HMR re-imported but never rebuilt.');
}

process.exit(results.every(([, ok]) => ok) ? 0 : 1);
