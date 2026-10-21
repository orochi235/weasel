const body = `import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import setup from 'virtual:forge/frame-config.js';

mountCapture({ index, importers, setup });
// The endpoint drops its captures on any edit; a page loaded before one would render the old module.
import.meta.hot?.accept('virtual:forge/importers.js', () => location.reload());
`;

/** The capture page for a story rendered in the workshop document: the shell's stylesheets. */
export function captureEntry(): string {
  return `import { mountCapture } from '@weasel-js/forge/frame';
import '@weasel-js/labkit/styles.css';
import '@weasel-js/forge/shell.css';
${body}`;
}

/** The capture page for an isolated story: a frame document's stylesheets. `styles` are absolute paths. */
export function captureFrameEntry(styles: readonly string[]): string {
  return `import { mountCapture } from '@weasel-js/forge/frame';
import '@weasel-js/forge/frame.css';
${styles.map((path) => `import ${JSON.stringify(path)};\n`).join('')}${body}`;
}
