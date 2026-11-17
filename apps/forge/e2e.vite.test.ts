import { resolve } from 'node:path';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { forge } from '@weasel-js/forge/vite';
import { csfChecks, smokeStory } from './e2e/stories.mjs';
import { stories } from './viteShared';

/** Every story id the workshop's index holds, read by forge's own plugin over the workshop's story globs. */
async function indexedIds(): Promise<Set<string>> {
  const server = await createServer({
    root: resolve(import.meta.dirname, '../..'),
    configFile: false,
    plugins: [forge({ stories })],
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    const index = (await server.ssrLoadModule('virtual:forge/index.js')) as { default: { id: string }[] };
    return new Set(index.default.map((entry) => entry.id));
  } finally {
    await server.close();
  }
}

describe("forge's headless checks", () => {
  it('open only stories the workshop holds', async () => {
    const ids = await indexedIds();
    expect([smokeStory, ...csfChecks.map((c) => c.id)].filter((id) => !ids.has(id))).toEqual([]);
  }, 60_000);
});
