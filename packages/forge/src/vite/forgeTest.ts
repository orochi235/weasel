import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { indexStoryResolved } from './indexStory.ts';
import { ownEntries } from './ownEntries.ts';
import { storybookShims } from './storybookShims.ts';
import { isStoryFile } from './storyGlob.ts';

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

  const matches = (id: string): boolean => !id.startsWith('\0') && !id.includes('?') && isStoryFile(root, id, options.stories);

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
        const q = (value: string) => JSON.stringify(value);
        // vitest fails a file that registers no test, so one with no stories to run says so as a skipped test.
        if (title === undefined) {
          const empty = [
            '',
            `import { TestRunner as __forge_runner, test as __forge_test } from "vitest";`,
            `if (__forge_runner.getCurrentSuite().file?.filepath === ${q(id)}) __forge_test.skip("no stories", () => {});`,
          ];
          return { code: `${code}\n${empty.join('\n')}\n`, map: null };
        }
        // The module comes from its own URL at test time: vitest imports a test file with a cache-busting query,
        // so a static self-import would evaluate the file a second time and register every test twice.
        const lines = [
          '',
          `import { TestRunner as __forge_runner, test as __forge_test } from "vitest";`,
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
          ...(entries[0]?.metaId === undefined ? [] : [`  metaId: ${q(entries[0].metaId)},`]),
          '};',
          'const __forge_run = async (exportName) => __forge_runStory(await import(/* @vite-ignore */ import.meta.url), exportName, __forge_file, __forge_title, __forge_options);',
          // A story file another one imports runs its stories under its own test file only.
          'if (__forge_runner.getCurrentSuite().file?.filepath === __forge_file) {',
          // An isolated story asks for a document of its own, which the test page is not; its reason goes in the name.
          ...entries.map((entry) =>
            entry.isolate === undefined
              ? `__forge_test(${q(entry.name)}, () => __forge_run(${q(entry.exportName)}), __forge_timeout);`
              : `__forge_test.skip(${q(`${entry.name} (isolated: ${entry.isolate})`)}, () => {});`,
          ),
          '}',
        ];
        return { code: `${code}\n${lines.join('\n')}\n`, map: null };
      },
    },
  ];
}
