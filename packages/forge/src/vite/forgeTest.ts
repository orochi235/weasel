import { relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { indexStoryResolved } from './indexStory.ts';
import { ownEntries } from './ownEntries.ts';
import { storybookShims } from './storybookShims.ts';
import { storyGlobOf } from './storyGlob.ts';

/** Options for the `forgeTest` vite plugin. */
export interface ForgeTestOptions {
  /** Globs of story files, relative to the vite root. Each matching file becomes a test file. */
  stories: string[];
  /** Path to the frame config module, relative to the vite root; it sets up every story. Optional. */
  frameConfig?: string;
  /** Alias Storybook's runtime modules to forge shims. Default true. */
  storybookShims?: boolean;
}

const TIMEOUT_MS = 15_000;

/**
 * A vite plugin for vitest browser mode: every story in a matching file runs as one test, rendered and played
 * through forge's frame in the test page itself.
 */
export function forgeTest(options: ForgeTestOptions): Plugin[] {
  let root = process.cwd();

  const matches = (id: string): boolean => {
    if (id.startsWith('\0') || id.includes('?')) return false;
    const path = relative(root, id).split(sep).join('/');
    if (path.startsWith('../') || path.split('/').includes('node_modules')) return false;
    return storyGlobOf(path, options.stories) !== undefined;
  };

  return [
    ...(options.storybookShims === false ? [] : [storybookShims()]),
    {
      name: 'weaselforge:test',
      enforce: 'pre',
      config(config) {
        const at = resolve(config.root ?? process.cwd());
        const entries = [
          ...options.stories,
          ...(options.frameConfig ? [resolve(at, options.frameConfig)] : []),
          ...ownEntries(['test']),
        ];
        return { optimizeDeps: { entries } };
      },
      configResolved(config) {
        root = config.root;
      },
      async transform(code, id) {
        if (!matches(id)) return undefined;
        const { entries } = await indexStoryResolved(
          code,
          id,
          { root, stories: options.stories },
          async (spec, importer) => (await this.resolve(spec, importer))?.id ?? null,
        );
        const title = entries[0]?.title;
        if (title === undefined) return undefined;
        const q = (value: string) => JSON.stringify(value);
        // The module comes from its own URL at test time: vitest imports a test file with a cache-busting query,
        // so a static self-import would evaluate the file a second time and register every test twice.
        const lines = [
          '',
          `import { test as __forge_test } from "vitest";`,
          `import { runStory as __forge_runStory } from "@weasel-js/forge/test";`,
          // shell.css draws the story host; frame.css still holds the boundary's fault rule.
          `import "@weasel-js/forge/shell.css";`,
          `import "@weasel-js/forge/frame.css";`,
          ...(options.frameConfig ? [`import __forge_frame_config from ${q(resolve(root, options.frameConfig))};`] : []),
          `const __forge_file = ${q(id)};`,
          `const __forge_title = ${q(title)};`,
          `const __forge_timeout = ${TIMEOUT_MS};`,
          'const __forge_options = {',
          `  setup: ${options.frameConfig ? '__forge_frame_config' : 'undefined'},`,
          '};',
          'const __forge_run = async (exportName) => __forge_runStory(await import(/* @vite-ignore */ import.meta.url), exportName, __forge_file, __forge_title, __forge_options);',
          // An isolated story asks for a document of its own, which the test page is not; its reason goes in the name.
          ...entries.map((entry) =>
            entry.isolate === undefined
              ? `__forge_test(${q(entry.name)}, () => __forge_run(${q(entry.exportName)}), __forge_timeout);`
              : `__forge_test.skip(${q(`${entry.name} (isolated: ${entry.isolate})`)}, () => {});`,
          ),
        ];
        return { code: `${code}\n${lines.join('\n')}\n`, map: null };
      },
    },
  ];
}
