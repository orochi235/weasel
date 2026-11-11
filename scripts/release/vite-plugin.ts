import type { PluginOption, ViteDevServer } from 'vite';
import { summarize, type Release } from '../../apps/shared/releases.ts';
import { readReleases } from './changelogs.ts';

/**
 * Virtual modules exposing every package CHANGELOG as one release history, newest version first.
 * The site's Releases view imports the index:
 *
 *   import RELEASES from 'virtual:changelogs';
 *
 * The index holds each release's summary (counts, highlights) and a `load()` that imports
 * `virtual:changelogs/<version>`, a chunk of its own holding that release's entries, so the page
 * fetches only the releases a reader opens.
 *
 * All packages ship as one changesets `fixed` group, so the per-package CHANGELOG files are views
 * of the same release. Entries are keyed by their changeset hash and merged across packages — one
 * entry naming the packages it touched. Pending `.changeset/*.md` files lead the list as
 * "Unreleased": the site deploys from `main` on every push but publishes to npm only on a release.
 *
 * Markdown is rendered to HTML here, at build time, so the client bundle carries no markdown parser.
 */
export function changelogs(opts: { root?: string } = {}): PluginOption {
  const INDEX_ID = 'virtual:changelogs';
  const PREFIX = `${INDEX_ID}/`;
  const root = opts.root ?? process.cwd();
  let cache: Release[] | null = null;
  const releases = () => (cache ??= readReleases(root));

  return {
    name: 'changelogs',
    resolveId(id) {
      if (id === INDEX_ID || id.startsWith(PREFIX)) return `\0${id}`;
      return null;
    },
    load(id) {
      if (id === `\0${INDEX_ID}`) {
        const items = releases().map((release) => {
          const summary = JSON.stringify(summarize(release));
          const chunk = JSON.stringify(PREFIX + release.version);
          return `  { ...${summary}, load: () => import(${chunk}).then((m) => m.default) }`;
        });
        return `export default [\n${items.join(',\n')}\n];\n`;
      }
      if (id.startsWith(`\0${PREFIX}`)) {
        const version = id.slice(PREFIX.length + 1);
        const release = releases().find((r) => r.version === version);
        return `export default ${JSON.stringify(release?.entries ?? [])};\n`;
      }
      return null;
    },
    configureServer(server: ViteDevServer) {
      server.watcher.on('change', (file) => {
        if (!file.endsWith('CHANGELOG.md') && !file.includes('.changeset') && !file.endsWith('history-meta.json')) return;
        cache = null;
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          if (mod.id?.startsWith(`\0${INDEX_ID}`)) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
  };
}
