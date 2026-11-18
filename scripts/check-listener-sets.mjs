#!/usr/bin/env node
/**
 * A store notifies through `createEmitter` from @weasel-js/registry, not a
 * listener set of its own. The emitter snapshots its listeners, skips one
 * unsubscribed mid-pass, and logs a throw instead of letting it stop the rest;
 * a hand-rolled `new Set<() => void>()` does none of that unless someone
 * remembers to. This fails the build on a `Set` of functions in kit and app
 * source, built or declared, and on a `Map` keeping an array of them per key;
 * listeners filed by key go in `createKeyedEmitter`.
 *
 * To add a site to the allowlist, say in the entry why the set is not a
 * listener set. An entry covers one use: a second in the same file fails until
 * the entry says how many it covers and why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judgeUses, matchLines, sourceFiles } from './lib/allowlisted-uses.mjs';

/** Paths that may build a `Set` of functions, and why. `[why, uses]` covers more than one use. */
const ALLOWED = new Map([
  ['packages/ui/src/components/Toast/queue.ts', 'not subscribers: the default-ttl readers of the mounted regions, of which only the latest is read'],
  ['packages/animator/src/engine/offsets.ts', 'not subscribers: the publishes one frame queued, deduplicated, run once and cleared'],
  ['packages/forge/src/shell/framePool.ts', 'not subscribers: the stop for each frame still loading, whose count sizes the pool'],
  ['packages/core/src/core/scene/notifier.ts', 'not subscribers: the notices one hold queued, deduplicated, run once when it settles and cleared'],
  ['packages/core/src/core/scene/outsideReads.ts', 'not subscribers: generation getters, read and summed, never notified'],
  ['packages/d3/src/transitionProgress.ts', 'not subscribers: the continuations a chain queues on its own items, taken and run once'],
  ['packages/animator/src/target.ts', 'not subscribers: the stops of animations over many targets, run once when this one is stopped'],
  ['packages/core/src/domains/ingestion/contentHandlers.ts', 'not subscribers: the admit releases of each registration of a handler, one popped per unregister'],
  ['packages/storage/src/memory.ts', 'each subscriber is told in a microtask of its own, after checking it is still subscribed'],
  ['packages/audio/src/graph/fader.ts', 'not subscribers: the done callbacks of one fade, each called once when it ends; audio depends on no kit package'],
  ['packages/audio/src/testing/fakeAudioContext.ts', "a fake of a platform object, reproducing the platform's semantics rather than the kit's"],
  ['packages/audio/src/testing/fakeMediaElement.ts', "a fake of a platform object, reproducing the platform's semantics rather than the kit's"],
  ['packages/audio/src/testing/fakeWorker.ts', "a fake of a Worker, reproducing the platform's semantics rather than the kit's"],
  ['packages/core/src/canvas/renderWorker/testing/fakeWorker.ts', "a fake of a Worker, reproducing the platform's semantics rather than the kit's"],
  ['packages/core/src/testing/matchMedia.ts', "a double of matchMedia, reproducing the platform's semantics rather than the kit's"],
  ['packages/react/src/testing/stubMatchMedia.ts', ["a stub of matchMedia, reproducing the platform's semantics rather than the kit's", 2]],
  ['apps/devtools-extension/src/testing/fakePorts.ts', "a fake of the browser's port events, reproducing the platform's semantics rather than the kit's"],
]);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'public', 'coverage']);
const isSource = (name) =>
  /\.(ts|tsx|mts)$/.test(name) &&
  !/\.(test|spec|stories|fixtures?)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts') &&
  name !== 'test-setup.ts';

/** A function type (`() => void`, `(m: M) => void`) or a type named for one (`Listener`, `ChangeSubscriber`). */
const FN = String.raw`(?:\([^<>]*?\)\s*=>|(?:[A-Z]\w*)?(?:Listener|Subscriber)\s*>)`;

const LISTENER_COLLECTION = new RegExp(
  [
    String.raw`\b(?:Readonly)?Set\s*<\s*${FN}`,
    String.raw`\b(?:Weak)?Map\s*<[^;=]*?,\s*(?:\(\s*\([^()]*\)\s*=>[^()]*\)\[\]|(?:Readonly)?Array\s*<\s*${FN})`,
    String.raw`\b(?:[A-Z]\w*)?(?:Listener|Subscriber)\[\]`,
    String.raw`\b(?:Readonly)?Array\s*<\s*(?:[A-Z]\w*)?(?:Listener|Subscriber)\s*>`,
  ].join('|'),
  'g',
);

/**
 * The 1-based lines of `source` outside a comment that name a collection of listeners, one per
 * naming: a `Set` of functions, built or declared (`new Set<() => void>()`,
 * `listeners: Set<Listener>`, `Map<string, Set<(e: E) => void>>`); a `Map` keeping an array of
 * functions per key; or an array of a type named for a listener (`Listener[]`).
 */
export const listenerSetLines = (source) => matchLines(source, LISTENER_COLLECTION);

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

  const found = new Map();
  for (const dir of sourceRoots(ROOT)) {
    for (const file of sourceFiles(dir, { skip: SKIP_DIRS, keep: isSource })) {
      const lines = listenerSetLines(readFileSync(file, 'utf8'));
      if (lines.length) found.set(relative(ROOT, file), lines);
    }
  }
  const { offenders, stale } = judgeUses(found, ALLOWED);

  if (offenders.length > 0) {
    console.error(
      `check:listener-sets — ${offenders.length} hand-rolled listener set(s):\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n\nNotify through `createEmitter` from @weasel-js/registry, or `createKeyedEmitter` for\n' +
        'listeners filed by key, which snapshot their listeners and keep one that throws from\n' +
        'stopping the rest.\n' +
        'A set of functions that are not subscribers goes on the allowlist in\n' +
        'scripts/check-listener-sets.mjs, saying why. A file listed there is on it\n' +
        'for fewer uses than it has.',
    );
    process.exit(1);
  }
  if (stale.length > 0) {
    console.error(
      `check:listener-sets — allowlist entries covering sets their files no longer build:\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nLower or remove each entry in scripts/check-listener-sets.mjs, so a new listener set cannot take its place.',
    );
    process.exit(1);
  }

  console.log('listener sets: every store notifies through createEmitter.');
}
