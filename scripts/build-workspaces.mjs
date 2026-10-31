// `npm run build`: builds each published workspace in BUILD_ORDER, one at a
// time, and stops at the first that fails. `npm run build -w a -w b …` carries
// on past a failure, so every dependent fails too and the log ends on a
// downstream TS7016 instead of the cause. `check:build-order` reads this list.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BUILD_ORDER = [
  '@weasel-js/registry',
  '@weasel-js/react',
  '@weasel-js/clock',
  '@weasel-js/simulation',
  '@weasel-js/storage',
  '@weasel-js/geom',
  '@weasel-js/icons',
  '@weasel-js/icons-plugin',
  '@weasel-js/history',
  '@weasel-js/quantity',
  '@weasel-js/headless',
  '@weasel-js/menu',
  '@weasel-js/gestures',
  '@weasel-js/paint',
  '@weasel-js/prefs',
  '@weasel-js/select',
  '@weasel-js/modes',
  '@weasel-js/stroke',
  '@weasel-js/theme',
  '@weasel-js/font',
  '@weasel-js/bidi',
  '@weasel-js/text-shaping',
  '@weasel-js/text',
  '@weasel-js/text-dom',
  '@weasel-js/renderer',
  '@weasel-js/pdf',
  '@weasel-js/audio',
  '@weasel-js/cursor',
  '@weasel-js/routing',
  '@weasel-js/animator',
  '@weasel-js/core',
  '@weasel-js/loupe',
  '@weasel-js/svg',
  '@weasel-js/d3',
  '@weasel-js/diagram',
  '@weasel-js/diagram-elk',
  '@weasel-js/diagram-formats',
  '@weasel-js/guides',
  '@weasel-js/kernel3d',
  '@weasel-js/parallax',
  '@weasel-js/minimap',
  '@weasel-js/symmetry',
  '@weasel-js/path-tools',
  '@weasel-js/rig',
  '@weasel-js/ui',
  '@weasel-js/editor',
  '@weasel-js/hud',
  '@weasel-js/devtools',
  '@weasel-js/labkit',
  '@weasel-js/forge',
];

/**
 * Calls `build` on each name in order and stops at the first nonzero exit.
 * @returns the workspace that failed and its exit code, or null when all built.
 */
export function buildInOrder(names, build) {
  for (const name of names) {
    const code = build(name);
    if (code !== 0) return { name, code };
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failed = buildInOrder(BUILD_ORDER, (name) => {
    const { status } = spawnSync('npm', ['run', 'build', '-w', name], { stdio: 'inherit' });
    return status ?? 1;
  });
  if (failed) {
    const skipped = BUILD_ORDER.length - BUILD_ORDER.indexOf(failed.name) - 1;
    console.error(`\n[build] ${failed.name} failed (exit ${failed.code}); stopped before the ${skipped} workspace(s) after it.`);
    process.exit(failed.code);
  }
}
