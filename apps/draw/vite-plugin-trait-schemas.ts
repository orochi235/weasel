/**
 * Dev/build Vite plugin that runs a ts-morph extractor over the kit source
 * and exposes the resulting `TraitSchemaIndex` via the virtual module
 *
 *   import schemas from 'virtual:weasel-trait-schemas';
 *
 * The Bundle Inspector renders schema panels from this index.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import { extractTraitSchemas, isWatched, watchedFilesFor } from './vite-plugin-trait-schemas/extract.ts';
import type { TraitSchemaIndex } from './src/dev/traitSchemas.types.ts';

const VIRTUAL_ID = 'virtual:weasel-trait-schemas';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export interface TraitSchemasPluginOptions {
  /** Absolute path to the repo root (passed in from the Vite config). */
  readonly repoRoot: string;
}

export function traitSchemasPlugin(opts: TraitSchemasPluginOptions): Plugin {
  let cached: TraitSchemaIndex | null = null;
  let server: ViteDevServer | null = null;

  const compute = (): TraitSchemaIndex => {
    if (!cached) cached = extractTraitSchemas(opts.repoRoot);
    return cached;
  };

  return {
    name: 'weasel:trait-schemas',
    configureServer(s) {
      server = s;
      // Watch the sources the extractors read so HMR fires when any of them
      // change. Chokidar dedups paths, and watches a directory's contents.
      const watched = watchedFilesFor(opts.repoRoot);
      for (const f of watched) s.watcher.add(f);
      const refresh = (file: string) => {
        if (!isWatched(watched, resolve(file))) return;
        cached = null;
        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod && server) server.moduleGraph.invalidateModule(mod);
        server?.ws.send({ type: 'full-reload' });
      };
      for (const event of ['change', 'add', 'unlink'] as const) s.watcher.on(event, refresh);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const index = compute();
      // Emit as a JSON-serializable default export. `JSON.stringify` keeps
      // the module small and avoids re-parsing TS.
      return `export default ${JSON.stringify(index)};\n`;
    },
  };
}
