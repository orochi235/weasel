const body = (mount: string) => `import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import setup from 'virtual:forge/frame-config.js';

${mount}
// The endpoint drops its captures on any edit; a page loaded before one would render the old module.
import.meta.hot?.accept('virtual:forge/importers.js', () => location.reload());
`;

/** The capture page for a story rendered in the workshop document: the shell's stylesheets and lab theme. */
export function captureEntry(): string {
  return `import { mountCapture } from '@weasel-js/forge/frame';
import '@weasel-js/labkit/styles.css';
import '@weasel-js/forge/shell.css';
import config from 'virtual:forge/shell-config.js';
${body(`mountCapture({
  index,
  importers,
  setup,
  labTheme: config.labTheme,
  libraries: config.libraries,
  dependencies: () => import('virtual:forge/deps.js').then((m) => m.default),
});`)}`;
}

/** The capture page for an isolated story: a frame document's stylesheets. `styles` are absolute paths. */
export function captureFrameEntry(styles: readonly string[]): string {
  return `import { mountCapture } from '@weasel-js/forge/frame';
import '@weasel-js/forge/frame.css';
${styles.map((path) => `import ${JSON.stringify(path)};\n`).join('')}${body('mountCapture({ index, importers, setup });')}`;
}
