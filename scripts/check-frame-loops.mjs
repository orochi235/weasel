#!/usr/bin/env node
/**
 * Every frame loop in the kit runs behind `useVisibleRaf`, so that "a weasel
 * loop does no work nobody can see" holds by construction rather than by each
 * loop's author remembering. A bare `requestAnimationFrame` in shipped source
 * is how that stops being true, so this fails the build on one.
 *
 * Tests, stories and app code are out of scope: they are not the surface the
 * rule is about. To add a site to the allowlist, say in the entry why the loop
 * cannot go through the gate.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGES = join(ROOT, 'packages');

/** Paths that may name `requestAnimationFrame`, and why. */
const ALLOWED = new Map([
  ['packages/core/src/scheduling/useVisibleRaf.ts', 'the gate itself'],
  [
    'packages/core/src/features/simulation/useSimulation.ts',
    'default for the injectable clock it hands to the gate',
  ],
]);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'storybook-static', 'examples']);
const isSource = (name) =>
  /\.(ts|tsx)$/.test(name) &&
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

const offenders = [];
for (const pkg of readdirSync(PACKAGES)) {
  const src = join(PACKAGES, pkg, 'src');
  try {
    if (!statSync(src).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const file of walk(src)) {
    const rel = relative(ROOT, file);
    if (ALLOWED.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Comments and doc prose name the API constantly; only calls matter.
      if (/^\s*(\*|\/\/)/.test(line)) return;
      if (/\brequestAnimationFrame\s*\(/.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
  }
}

if (offenders.length > 0) {
  console.error(
    `check:frame-loops — ${offenders.length} bare requestAnimationFrame call(s) in kit source:\n` +
      offenders.map((o) => `  ${o}`).join('\n') +
      "\n\nRoute the loop through `useVisibleRaf` from @weasel-js/core. A loop that\n" +
      'measures elapsed time also needs `onResume` to rebase its clock.\n' +
      'See docs/proposals/2026-08-26-loops-stop-when-unseen.md.',
  );
  process.exit(1);
}

console.log('frame loops: every kit loop runs behind the visibility gate.');
