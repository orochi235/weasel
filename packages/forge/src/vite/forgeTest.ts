import { matchesGlob, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { autoTitle } from './autoTitle';
import { indexFile } from './indexFile';
import { storybookShims } from './storybookShims';

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
    return options.stories.some((pattern) => matchesGlob(path, pattern));
  };

  return [
    ...(options.storybookShims === false ? [] : [storybookShims()]),
    {
      name: 'weaselforge:test',
      enforce: 'pre',
      configResolved(config) {
        root = config.root;
      },
      transform(code, id) {
        if (!matches(id)) return undefined;
        const title = autoTitle(id, root, options.stories);
        const entries = indexFile(code, id, title);
        if (entries.length === 0) return undefined;
        const q = (value: string) => JSON.stringify(value);
        // The module comes from its own URL at test time: vitest imports a test file with a cache-busting query,
        // so a static self-import would evaluate the file a second time and register every test twice.
        const lines = [
          '',
          `import { test as __forge_test } from "vitest";`,
          `import { page as __forge_page } from "vitest/browser";`,
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
          '  viewport: (width, height) => __forge_page.viewport(width, height),',
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
