#!/usr/bin/env node
/**
 * A store notifies through `createEmitter` from @weasel-js/registry, not a
 * listener set of its own. The emitter snapshots its listeners, skips one
 * unsubscribed mid-pass, and logs a throw instead of letting it stop the rest;
 * a hand-rolled `new Set<() => void>()` does none of that unless someone
 * remembers to. This fails the build on a `new Set` of functions in kit and app
 * source.
 *
 * To add a site to the allowlist, say in the entry why the set is not a
 * listener set. An entry covers one use: a second in the same file fails until
 * the entry says how many it covers and why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Paths that may build a `Set` of functions, and why. `[why, uses]` covers more than one use. */
const ALLOWED = new Map([
  ['packages/registry/src/emitter.ts', 'the emitter itself'],
  ['packages/animator/src/engine/offsets.ts', 'not subscribers: the publishes one frame queued, deduplicated, run once and cleared'],
  ['packages/forge/src/shell/framePool.ts', 'not subscribers: the stop for each frame still loading, whose count sizes the pool'],
  ['packages/d3/src/transition.ts', 'not subscribers: the cancels pending on one node, run when something else claims it'],
  ['packages/audio/src/graph/fader.ts', 'not subscribers: the done callbacks of one fade, each called once when it ends; audio depends on no kit package'],
  ['packages/audio/src/testing/fakeAudioContext.ts', "a fake of a platform object, reproducing the platform's semantics rather than the kit's"],
  ['packages/react/src/testing/stubReducedMotion.ts', "a stub of matchMedia, reproducing the platform's semantics rather than the kit's"],
  ['apps/devtools-extension/src/testing/fakePorts.ts', "a fake of the browser's port events, reproducing the platform's semantics rather than the kit's"],
]);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'public', 'coverage']);
const isSource = (name) =>
  /\.(ts|tsx|mts)$/.test(name) &&
  !/\.(test|spec|stories)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts') &&
  name !== 'test-setup.ts';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (isSource(entry)) yield full;
  }
}

/** `source` with its comments blanked, line breaks kept. A `//` after a `:` is taken for a URL. */
const withoutComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(?<!:)\/\/.*$/gm, '');

/**
 * The 1-based lines of `source` that build a `Set` of functions outside a comment: a function type
 * (`new Set<() => void>()`, `new Set<(m: M) => void>`) or a type named for one (`new Set<Listener>()`,
 * `new Set<ChangeSubscriber>`).
 */
export function listenerSetLines(source) {
  const lines = new Set();
  const clean = withoutComments(source);
  const pattern = /\bnew\s+Set\s*<\s*(?:\([^<>]*?\)\s*=>|(?:[A-Z]\w*)?(?:Listener|Subscriber)\s*>)/g;
  for (const match of clean.matchAll(pattern)) {
    lines.add(clean.slice(0, match.index).split('\n').length);
  }
  return [...lines];
}

/** `lines` when a file has more uses than its allowlist entry covers, else none. */
export function offendingLines(lines, allowedUses = 0) {
  return lines.length > allowedUses ? lines : [];
}

/** Each kit package's `src` and each app, under `root`. */
function sourceRoots(root) {
  const roots = [];
  const packages = join(root, 'packages');
  for (const pkg of readdirSync(packages)) {
    const src = join(packages, pkg, 'src');
    try {
      if (statSync(src).isDirectory()) roots.push(src);
    } catch {
      // A directory with no src ships nothing.
    }
  }
  roots.push(join(root, 'apps'));
  return roots;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));

  const offenders = [];
  for (const dir of sourceRoots(ROOT)) {
    for (const file of walk(dir)) {
      const rel = relative(ROOT, file);
      const entry = ALLOWED.get(rel);
      const allowedUses = entry === undefined ? 0 : Array.isArray(entry) ? entry[1] : 1;
      const lines = offendingLines(listenerSetLines(readFileSync(file, 'utf8')), allowedUses);
      for (const line of lines) offenders.push(`${rel}:${line}`);
    }
  }

  if (offenders.length > 0) {
    console.error(
      `check:listener-sets — ${offenders.length} hand-rolled listener set(s):\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n\nNotify through `createEmitter` from @weasel-js/registry, which snapshots its\n' +
        'listeners and keeps one that throws from stopping the rest.\n' +
        'A set of functions that are not subscribers goes on the allowlist in\n' +
        'scripts/check-listener-sets.mjs, saying why. A file listed there is on it\n' +
        'for fewer uses than it has.',
    );
    process.exit(1);
  }

  console.log('listener sets: every store notifies through createEmitter.');
}
