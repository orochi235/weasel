import type { Plugin } from 'vite';
import { PROP_ARG_TYPES_EXPORT } from '../csf/propArgTypes.ts';
import { API_EXPORT } from '../story/api.ts';
import { createPropReader, type PropControlsOptions, type PropReader } from './propTypes.ts';

/** Which readings a story module gets. */
export interface StoryExportsOptions {
  controls: boolean;
  api: boolean;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * What to append to story module `file`: the argTypes read from its component's props, and its component's API, each
 * as a named export. `sources` are the files those were read from, which an edit to must reach the story.
 */
export function storyExports(
  reader: PropReader,
  file: string,
  fallback: string | undefined,
  { controls, api }: StoryExportsOptions,
  warn: (message: string) => void,
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
      warn(`could not read the props for ${file}: ${errorText(err)}`);
    }
  }
  if (api) {
    try {
      const read = reader.api(file, fallback);
      const table = read && { props: read.props, inherited: read.inherited, ref: read.ref };
      code += `\nexport const ${API_EXPORT} = ${JSON.stringify(table)};\n`;
      if (read) sources.push(...read.sources);
    } catch (err) {
      warn(`could not read the API for ${file}: ${errorText(err)}`);
    }
  }
  return { code, sources };
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
): Plugin {
  let root = process.cwd();
  /** Built on the first story module served, so the TypeScript program costs nothing until a story is opened. */
  let reader: Promise<PropReader | null> | null = null;
  return {
    name: 'weaselforge:prop-controls',
    configResolved(config) {
      root = config.root;
      reader = null;
    },
    async transform(code, id) {
      if (!stories().includes(id)) return undefined;
      const props = await (reader ??= createPropReader(root, stories, options));
      if (!props) return undefined;
      const added = storyExports(props, id, fallbackOf(id), readings, (message) => this.warn(message));
      if (!added.code) return undefined;
      // A props type imported as a type is not in the module graph, so an edit to it would not reach the story.
      for (const source of new Set(added.sources)) this.addWatchFile(source);
      return { code: code + added.code, map: null };
    },
  };
}
