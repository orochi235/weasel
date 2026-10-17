/**
 * @weasel-js/prefs/vite — a Vite plugin serving prefs schemas' defaults as a
 * stylesheet. Vite is an optional peer of this package; nothing else loads it.
 *
 * @packageDocumentation
 */
import { resolve } from 'node:path';
import { runnerImport, type Plugin, type ResolvedConfig } from 'vite';
import { prefsCss, type PrefsCssOptions } from './css';
import { prefsDefaultsSource } from './defaultsSource';
import type { PrefGroup } from './groups';

const ID = 'virtual:weasel-prefs.css';
const RESOLVED = `\0${ID}`;

/** Options for {@link weaselPrefsCss}. */
export interface WeaselPrefsCssOptions {
  /** Each schema to write: the module, as a path from Vite's root, and the name it exports its `PrefGroup` under. */
  schemas: Record<string, string>;
  /** How each schema is written, as `prefsCss` takes it. */
  css?: PrefsCssOptions;
}

/**
 * Serves `virtual:weasel-prefs.css`: every schema's `prefsCss` at its
 * defaults, in the order `schemas` lists them, through Vite's own CSS
 * pipeline. Import it once (`import 'virtual:weasel-prefs.css'`). Schemas are
 * loaded with Vite's `runnerImport`, so they may be TypeScript; in dev, saving
 * a schema module or anything it imports rewrites the sheet.
 */
export function weaselPrefsCss(options: WeaselPrefsCssOptions): Plugin {
  let config: ResolvedConfig;
  let sheet: Promise<{ css: string; files: Set<string> }> | null = null;
  let files = new Set<string>();

  const build = async (): Promise<{ css: string; files: Set<string> }> => {
    const parts: string[] = [];
    const read = new Set<string>();
    for (const [id, name] of Object.entries(options.schemas)) {
      const file = resolve(config.root, id);
      const { module, dependencies } = await runnerImport<Record<string, unknown>>(file, {
        root: config.root,
        logLevel: 'error',
        resolve: { alias: config.resolve.alias },
      });
      read.add(file);
      for (const dependency of dependencies) read.add(dependency);
      const schema = module[name] as PrefGroup | undefined;
      if (!schema || typeof schema !== 'object' || !('children' in schema)) {
        throw new Error(`[weasel-prefs] ${id} exports no PrefGroup named "${name}"`);
      }
      parts.push(prefsCss(prefsDefaultsSource(schema), options.css));
    }
    return { css: parts.join('\n\n'), files: read };
  };

  return {
    name: 'weasel-prefs-css',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return undefined;
      const pending = (sheet ??= build());
      try {
        const built = await pending;
        files = built.files;
        for (const file of files) this.addWatchFile(file);
        return built.css;
      } catch (error) {
        if (sheet === pending) sheet = null;
        throw error;
      }
    },
    watchChange(id) {
      if (files.has(id)) sheet = null;
    },
  };
}
