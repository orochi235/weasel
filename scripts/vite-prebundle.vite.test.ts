// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Worker } from 'node:worker_threads';
import { createServer, type InlineConfig } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prebundleWorkspace, restartLeavingNothing } from './vite-prebundle.ts';

const started: Worker[] = [];
const onWorker = (worker: Worker) => { started.push(worker); };

/** Worker threads a dev server starts while compiling a less file, restarting the way a package edit does, and again. */
async function threadsAcrossRestarts(config: InlineConfig): Promise<{ threads: number; css: string }> {
  const before = started.length;
  const server = await createServer(config);
  let css = '';
  try {
    for (let i = 0; i < 3; i++) {
      css = (await server.transformRequest('/a.less'))?.code ?? '';
      if (i < 2) await restartLeavingNothing(server);
    }
  } finally {
    await server.close();
  }
  return { threads: started.length - before, css };
}

describe('prebundleWorkspace across dev server restarts', () => {
  let root: string;
  const sourceBefore = process.env.WEASEL_DEV_SOURCE;
  const base = (): InlineConfig => ({
    root,
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'prebundle-restarts-')));
    writeFileSync(join(root, 'a.less'), '@ink: #102030;\n.a { color: @ink; }\n');
    process.on('worker', onWorker);
  });
  afterAll(async () => {
    process.off('worker', onWorker);
    await Promise.all(started.map((worker) => worker.terminate()));
    rmSync(root, { recursive: true, force: true });
    if (sourceBefore === undefined) delete process.env.WEASEL_DEV_SOURCE;
    else process.env.WEASEL_DEV_SOURCE = sourceBefore;
  });

  it('starts a preprocessor thread per server without it, which a restart never ends', async () => {
    const { threads } = await threadsAcrossRestarts(base());
    expect(threads).toBe(3);
  });

  it('compiles less on the main thread, so a restart leaves no thread behind', async () => {
    // Source mode skips the bundling, which would walk the whole repository.
    process.env.WEASEL_DEV_SOURCE = '1';
    const plugin = prebundleWorkspace(resolve(import.meta.dirname, '..'), [root]);
    const { threads, css } = await threadsAcrossRestarts({ ...base(), plugins: [plugin] });
    expect(threads).toBe(0);
    expect(css).toContain('#102030');
  });
});
