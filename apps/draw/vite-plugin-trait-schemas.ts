/**
 * Dev/build Vite plugin that runs a ts-morph extractor over the kit source
 * and exposes the resulting `TraitSchemaIndex` via the virtual module
 *
 *   import schemas from 'virtual:weasel-trait-schemas';
 *
 * The Bundle Inspector consumes this index to render schema panels for
 * shape kinds, op factories, actions, gestures, and the SceneNode shape.
 *
 * The extractor runs lazily on first `load()` and the result is cached.
 * In `serve` mode, edits to any of the watched source files invalidate the
 * virtual module so the inspector picks up new schemas on the next render.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import { extractTraitSchemas, watchedFilesFor } from './vite-plugin-trait-schemas/extract';
import type { TraitSchemaIndex } from './src/dev/traitSchemas.types';

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
      // Watch the source files the extractor depends on so HMR fires when
      // any of them change. Chokidar dedups paths.
      const watched = watchedFilesFor(opts.repoRoot);
      for (const f of watched) s.watcher.add(f);
      s.watcher.on('change', (file) => {
        const abs = resolve(file);
        if (!watched.includes(abs)) return;
        cached = null;
        const mod = server?.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod && server) server.moduleGraph.invalidateModule(mod);
        server?.ws.send({ type: 'full-reload' });
      });
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
