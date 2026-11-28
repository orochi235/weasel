import { type Stats, unwatchFile, watchFile } from 'node:fs';
import type { Plugin, ViteDevServer } from 'vite';
import { posixResolve } from './posixPath.ts';
import { PROP_ARG_TYPES_EXPORT } from '../csf/propArgTypes.ts';
import { API_EXPORT } from '../story/api.ts';
import { createPropReader, type PropControlsOptions, type PropReader } from './propTypes.ts';
import { type TypedocDocs, type TypedocHref, typedocSource, withTypedoc } from './typedoc/index.ts';
import { messageOf } from '../messageOf.ts';

/** TypeDoc's JSON, at `file`, as it now reads. */
export interface TypedocReading {
  file: string;
  docs(): TypedocDocs | null;
}

/** Which readings a story module gets. */
export interface StoryExportsOptions {
  controls: boolean;
  api: boolean;
}

/** Where TypeDoc's JSON is, and the page each export it documents is on. */
export interface TypedocOptions {
  /** The JSON `typedoc --json` wrote, relative to the vite root. Default `dist/typedoc.json`. */
  json?: string;
  /** The address of an export's page in the API reference; without it, the panel links to none. */
  href?: TypedocHref;
}


/**
 * What to append to story module `file`: the argTypes read from its component's props, and its component's API, each
 * as a named export, the API enriched from TypeDoc's output where `typedoc` has some. `sources` are the files those
 * were read from, which an edit to must reach the story.
 */
export function storyExports(
  reader: PropReader,
  file: string,
  fallback: string | undefined,
  { controls, api }: StoryExportsOptions,
  warn: (message: string) => void,
  typedoc?: TypedocReading,
): { code: string; sources: string[] } {
  let code = '';
  const sources: string[] = [];
  if (controls) {
    try {
      const table = reader.read(file);
      if (table && Object.keys(table.argTypes).length > 0) {
        code += `\nexport const ${PROP_ARG_TYPES_EXPORT} = ${JSON.stringify(table.argTypes)};\n`;
        sources.push(...table.sources);
      }
    } catch (err) {
      warn(`could not read the props for ${file}: ${messageOf(err)}`);
    }
  }
  if (api) {
    try {
      const live = reader.api(file, fallback);
      const docs = typedoc?.docs() ?? null;
      const read = live && docs ? withTypedoc(live, docs) : live;
      const table = read && {
        props: read.props,
        inherited: read.inherited,
        ref: read.ref,
        ...(read.types ? { types: read.types } : {}),
        ...(read.href ? { href: read.href } : {}),
      };
      code += `\nexport const ${API_EXPORT} = ${JSON.stringify(table)};\n`;
      if (read) sources.push(...read.sources);
      // Watched only once it exists: vite resolves a watched file as an import, and a missing one fails the story.
      if (read && typedoc && docs && read.component) sources.push(typedoc.file);
    } catch (err) {
      warn(`could not read the API for ${file}: ${messageOf(err)}`);
    }
  }
  return { code, sources };
}

/** How often the dev server checks TypeDoc's JSON for a new write, in milliseconds. */
const TYPEDOC_POLL_MS = 1000;

/**
 * Reloads each of `stories` the dev server has served when the JSON at `file` is written. Polled, because vite's
 * watcher ignores the build's output directory, where the JSON is by default, and a file not there yet. Returns the
 * stop.
 */
function reloadOnTypedoc(server: ViteDevServer, file: string, stories: ReadonlySet<string>): () => void {
  const client = server.environments.client;
  const reload = (now: Stats, before: Stats) => {
    if (now.mtimeMs === before.mtimeMs) return;
    for (const id of stories) {
      const mod = client.moduleGraph.getModuleById(id);
      if (mod) client.reloadModule(mod).catch((err: unknown) => server.config.logger.error(`[forge] ${messageOf(err)}`));
    }
  };
  watchFile(file, { interval: TYPEDOC_POLL_MS, persistent: false }, reload);
  return () => unwatchFile(file, reload);
}

/**
 * Appends to each story module the argTypes read from the props of its meta's `component`, which the CSF loader merges
 * under the story's own, and the component's API, which its index page shows. `stories` are the story files, as
 * absolute paths; `fallbackOf` names the import standing in for a meta that names no component.
 */
export function propControls(
  stories: () => readonly string[],
  fallbackOf: (file: string) => string | undefined,
  readings: StoryExportsOptions,
  options: PropControlsOptions = {},
  typedocOptions: TypedocOptions | false = {},
): Plugin {
  let root = process.cwd();
  let typedoc: TypedocReading | undefined;
  /** Built on the first story module served, so the TypeScript program costs nothing until a story is opened. */
  let reader: Promise<PropReader | null> | null = null;
  let serving = false;
  /** The story modules served with an API reading, which a new TypeDoc JSON reloads. */
  const served = new Set<string>();
  /** Each open server's stop for its TypeDoc poll, oldest first, as a restart opens the new before closing the old. */
  const stops: (() => void)[] = [];
  return {
    name: 'weaselforge:prop-controls',
    configResolved(config) {
      root = config.root;
      serving = config.command === 'serve';
      served.clear();
      reader = null;
      typedoc = undefined;
      if (typedocOptions !== false && readings.api) {
        const file = posixResolve(root, typedocOptions.json ?? 'dist/typedoc.json');
        typedoc = { file, ...typedocSource(file, typedocOptions.href) };
      }
    },
    configureServer(server) {
      if (typedoc) stops.push(reloadOnTypedoc(server, typedoc.file, served));
    },
    closeServer() {
      stops.shift()?.();
    },
    async transform(code, id) {
      if (!stories().includes(id)) return undefined;
      if (!reader) {
        const building: Promise<PropReader | null> = createPropReader(root, stories, options).catch((err: unknown) => {
          // Dropped, so the story after a fix to what broke it (often tsconfig.json) builds the reader again.
          if (reader === building) reader = null;
          this.warn(`prop controls and the API table are off for this story: the TypeScript reader failed: ${messageOf(err)}`);
          return null;
        });
        reader = building;
      }
      const props = await reader;
      if (!props) return undefined;
      const added = storyExports(props, id, fallbackOf(id), readings, (message) => this.warn(message), typedoc);
      if (!added.code) return undefined;
      if (serving && typedoc) served.add(id);
      // A props type imported as a type is not in the module graph, so an edit to it would not reach the story.
      for (const source of new Set(added.sources)) if (!(serving && source === typedoc?.file)) this.addWatchFile(source);
      return { code: code + added.code, map: null };
    },
  };
}
