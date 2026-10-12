import type { Plugin } from 'vite';
import { PROP_ARG_TYPES_EXPORT } from '../csf/propArgTypes.ts';
import { createPropReader, type PropReader } from './propTypes.ts';

/**
 * Appends to each story module the argTypes read from the props of its meta's `component`, as a named export the
 * CSF loader merges under the story's own. `stories` are the story files, as absolute paths.
 */
export function propControls(stories: () => readonly string[]): Plugin {
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
      const props = await (reader ??= createPropReader(root, stories));
      let table: ReturnType<PropReader['read']> = null;
      try {
        table = props?.read(id) ?? null;
      } catch (err) {
        this.warn(`could not read the props for ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!table || Object.keys(table.argTypes).length === 0) return undefined;
      // A props type imported as a type is not in the module graph, so an edit to it would not reach the story.
      for (const source of table.sources) this.addWatchFile(source);
      return { code: `${code}\nexport const ${PROP_ARG_TYPES_EXPORT} = ${JSON.stringify(table.argTypes)};\n`, map: null };
    },
  };
}
