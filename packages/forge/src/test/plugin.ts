import { matchesGlob, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { indexFile } from '../vite/indexFile';
import { storybookShims } from '../vite/plugin';

export interface ForgeTestOptions {
  /** Globs of story files, relative to the vite root. Each matching file becomes a test file. */
  stories: string[];
  /** Path to forge.config, relative to the vite root; its `frame` half wraps every story. Optional. */
  config?: string;
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
        const entries = indexFile(code, id, root);
        if (entries.length === 0) return undefined;
        const q = (value: string) => JSON.stringify(value);
        // The module comes from its own URL at test time: vitest imports a test file with a cache-busting query,
        // so a static self-import would evaluate the file a second time and register every test twice.
        const lines = [
          '',
          `import { test as __forge_test } from "vitest";`,
          `import { page as __forge_page } from "vitest/browser";`,
          `import { runStory as __forge_runStory } from "@weasel-js/forge/test";`,
          `import "@weasel-js/forge/frame.css";`,
          ...(options.config ? [`import __forge_config from ${q(resolve(root, options.config))};`] : []),
          'const __forge_options = {',
          `  setup: ${options.config ? '__forge_config.frame' : 'undefined'},`,
          '  viewport: (width, height) => __forge_page.viewport(width, height),',
          '};',
          ...entries.map(
            (entry) =>
              `__forge_test(${q(entry.name)}, async () => __forge_runStory(await import(/* @vite-ignore */ import.meta.url), ${q(entry.exportName)}, ${q(id)}, ${q(root)}, __forge_options), ${TIMEOUT_MS});`,
          ),
        ];
        return { code: `${code}\n${lines.join('\n')}\n`, map: null };
      },
    },
  ];
}
