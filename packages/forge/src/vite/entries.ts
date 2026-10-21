/** The workshop page's entry module. `stories` are the globs, shown when they match nothing. */
export function shellEntry(base: string, stories: readonly string[]): string {
  return `import { mountWorkshop } from '@weasel-js/forge/shell';
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
  stories: ${JSON.stringify(stories)},
});
import.meta.hot?.on('forge:index', (next) => workshop.setIndex(next));
// Read from source on first request, so the graph costs nothing until the page is up.
import('virtual:forge/deps.js').then((m) => workshop.setDependencies(m.default));
import.meta.hot?.on('forge:deps', (next) => workshop.setDependencies(next));
// An edit to a story file, or to a module one imports, reaches here as an update of the importers module, whose
// fresh import() URLs carry the new timestamps; the files it reaches arrive just before, so the reload waits for
// the importers that can fetch them. Either one also means a capture taken before it shows a story that is gone.
const stale = new Set();
import.meta.hot?.on('forge:story', ({ file }) => {
  stale.add(file);
  workshop.revise();
});
import.meta.hot?.accept('virtual:forge/importers.js', (next) => {
  workshop.revise();
  if (!next) return;
  workshop.setImporters(next.default);
  for (const file of stale) workshop.reloadStory(file);
  stale.clear();
});
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
