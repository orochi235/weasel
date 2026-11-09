#!/usr/bin/env node
/**
 * Every frame loop in the kit and its apps runs behind `useVisibleRaf`, so a loop does no
 * work nobody can see. This fails the build on a bare `requestAnimationFrame`
 * or `setInterval` in package or app source.
 *
 * To add a site to the allowlist, say in the entry why the loop cannot go
 * through the gate. An entry covers one use: a second in the same file fails
 * until the entry says how many it covers and why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judgeUses, matchLines, sourceFiles } from './lib/allowlisted-uses.mjs';

/** Paths that may name `requestAnimationFrame` or `setInterval`, and why. `[why, uses]` covers more than one use. */
const ALLOWED = new Map([
  ['packages/react/src/useVisibleRaf.ts', 'the gate itself'],
  ['packages/forge/src/test/runStory.tsx', 'not a loop: a story test waits for one painted frame before checking faults'],
  ['packages/forge/src/shell/storyShow.ts', 'not a loop: an in-document story waits for one painted frame after its fonts settle before announcing it rendered'],
  ['packages/forge/src/frame/FrameController.tsx', 'not a loop: a story frame waits for one painted frame after its fonts settle before announcing it rendered'],
  ['packages/text-dom/src/testing/overlayReady.ts', 'test helper, not a loop: waits a bounded number of frames for the edit overlay to mount and settle'],
  ['packages/react/src/testing/renderSettled.tsx', ['test helper, not a loop: swaps the frame functions to hold the frames an async act would otherwise never outlast, and puts them back', 4]],
  ['packages/core/src/canvas/testing/stubCanvasContext.ts', 'test helper, not a loop: waits for one frame so a test can read what the canvas painted'],
  ['packages/ui/src/useRowNavigation.ts', 'not a loop: a keyboard move waits one frame for its re-render before giving up on moving focus'],
  ['packages/labkit/src/lab/still.ts', 'not a loop: a still waits a bounded number of frames after its fonts settle before announcing it painted'],
  ['packages/forge/src/vite/watchProbe.ts', ['not a frame loop: the dev server rewrites a probe file in its Node process until the file watcher reports it or a deadline passes', 2]],
  ['packages/forge/src/vite/watchRecovery.ts', ['not a frame loop: an unref\'d timer in the dev server\'s Node process stats served files while the file watcher is quiet', 2]],
  ['packages/core/src/devtools/hook.ts', ['not a loop: a devtools session waits one frame to send the change notices that frame gathered as one, where the platform has frames', 2]],
  ['packages/forge/src/frame/index/startIndex.tsx', 'not a loop: an index page waits for one painted frame after its fonts settle before announcing it rendered'],
  ['apps/chart/src/testing/pointer.ts', 'test helper, not a loop: waits a given number of frames for a dispatched pointer event to paint'],
  ['apps/draw/src/replay.ts', ['not a loop: a recording replays one event per frame, and finishes', 2]],
]);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-examples', 'examples']);
const isSource = (name) =>
  /\.(ts|tsx)$/.test(name) &&
  !/\.(test|spec|stories)\.(ts|tsx)$/.test(name) &&
  !name.endsWith('.d.ts') &&
  name !== 'test-setup.ts';

/**
 * The 1-based lines of `source` that name `requestAnimationFrame` or `setInterval` outside a comment. Any use
 * counts, not only a call: an alias or a `.bind` is a loop one step removed, and a call can put its `(` on the
 * next line.
 */
export const frameLoopLines = (source) => matchLines(source, /\b(?:requestAnimationFrame|setInterval)\b/g);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const PACKAGES = join(ROOT, 'packages');

  const APPS = join(ROOT, 'apps');
  const roots = [
    ...readdirSync(PACKAGES).map((pkg) => join(PACKAGES, pkg, 'src')),
    // An app is a reference implementation, held to the same rule, and keeps its source at its root or under src/.
    ...readdirSync(APPS).map((app) => join(APPS, app)),
  ];

  const found = new Map();
  for (const src of roots) {
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(src, { skip: SKIP_DIRS, keep: isSource })) {
      const lines = frameLoopLines(readFileSync(file, 'utf8'));
      if (lines.length) found.set(relative(ROOT, file), lines);
    }
  }
  const { offenders, stale } = judgeUses(found, ALLOWED);

  if (offenders.length > 0) {
    console.error(
      `check:frame-loops — ${offenders.length} bare requestAnimationFrame or setInterval use(s) in kit or app source:\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        "\n\nRoute the loop through `useVisibleRaf` from @weasel-js/react. A loop that\n" +
        'measures elapsed time also needs `onResume` to rebase its clock.\n' +
        'A file listed here is on the allowlist for fewer uses than it has.\n' +
        'See docs/proposals/2026-08-26-loops-stop-when-unseen.md.',
    );
    process.exit(1);
  }
  if (stale.length > 0) {
    console.error(
      `check:frame-loops — allowlist entries covering uses their files no longer have:\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nLower or remove each entry in scripts/check-frame-loops.mjs, so a new bare use cannot take its place.',
    );
    process.exit(1);
  }

  console.log('frame loops: every kit and app loop runs behind the visibility gate.');
}
