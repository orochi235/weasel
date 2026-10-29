/** The workshop page's entry module. `stories` are the globs, shown when they match nothing. */
export function shellEntry(base: string, stories: readonly string[]): string {
  return `import { followEdits, mountWorkshop } from '@weasel-js/forge/shell';
import '@weasel-js/labkit/styles.css';
import '@weasel-js/forge/shell.css';
import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import config from 'virtual:forge/shell-config.js';
import setup from 'virtual:forge/frame-config.js';

const workshop = mountWorkshop({
  index,
  importers,
  setup,
  config,
  frameUrl: ${JSON.stringify(`${base}frame.html`)},
  captureBase: ${JSON.stringify(base)},
  issuesBase: ${JSON.stringify(base)},
  stories: ${JSON.stringify(stories)},
});
// Read from source on first request, so the graph costs nothing until the page is up.
import('virtual:forge/deps.js').then((m) => workshop.setDependencies(m.default));
const edits = followEdits(import.meta.hot, workshop);
import.meta.hot?.accept('virtual:forge/importers.js', (next) => edits.importers(next?.default));
`;
}

/** A frame document's entry module. `styles` are absolute paths to the stylesheets frames alone load. */
export function frameEntry(styles: readonly string[]): string {
  return `import { mountFrame } from '@weasel-js/forge/frame';
import '@weasel-js/forge/frame.css';
${styles.map((path) => `import ${JSON.stringify(path)};\n`).join('')}import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import setup from 'virtual:forge/frame-config.js';

mountFrame({ index, importers, setup });
// The importers module is shared with the workshop page, which accepts a story edit in place; a frame document
// showing the old module reloads instead, and without this the edit would dead-end here and reload every page.
import.meta.hot?.accept('virtual:forge/importers.js', () => location.reload());
`;
}
