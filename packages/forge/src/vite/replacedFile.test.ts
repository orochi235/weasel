// @vitest-environment node
import { mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { forge } from './plugin';
import { fileEventsArrive } from './watchProbe';

/** Under a loaded machine the watcher's first scan alone has taken seconds. */
const FOLLOWS = { timeout: 15_000, interval: 250 };

/** A real watcher serves nothing in this state, so a failure would say nothing about forge. */
const NO_EVENTS = 'the OS is reporting no file changes, so no watcher can follow a replaced file';

describe('a forge dev server, when an editor replaces a file whole', () => {
  let root: string;
  let server: ViteDevServer;
  let events = true;

  /** Writes beside `file` and renames over it, so the path gets a new inode, as an editor's atomic save does. */
  const replace = (file: string, text: string) => {
    writeFileSync(`${file}.tmp`, text);
    renameSync(`${file}.tmp`, file);
  };
  const served = async (url: string) => (await server.transformRequest(url))?.code ?? '';

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-replaced-')));
    writeFileSync(join(root, 'a.stories.tsx'), `export default { title: 'ui/A' };\nexport const One = {};\n`);
    writeFileSync(join(root, 'part.css'), `.part { top: 0px; }\n`);
    writeFileSync(join(root, 'sheet.css'), `@import './part.css';\n`);
    writeFileSync(join(root, 'part.ts'), `export const part = 0;\n`);
    events = await fileEventsArrive({ waitMs: 3000 });
    server = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: ['*.stories.tsx'] })],
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });
  });

  afterAll(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  /**
   * Replaces `file` with each text in turn, rewriting it until `url` serves that text. One write is not enough: a
   * write before the watcher's first scan ends goes unseen, and chokidar drops a change that lands within 50 ms of
   * the last one it reported. A replacement that cost the path its watch leaves every later text unserved however
   * often it is rewritten.
   */
  const follows = async (file: string, url: string, texts: string[]) => {
    for (const text of texts) {
      await expect
        .poll(() => {
          replace(file, text);
          return served(url);
        }, FOLLOWS)
        .toContain(text.trim());
    }
  };

  it('serves each replacement of a stylesheet another one imports, the third as well as the first', async ({ skip }) => {
    skip(!events, NO_EVENTS);
    expect(await served('/sheet.css')).toContain('top: 0px');
    await follows(join(root, 'part.css'), '/sheet.css', ['.part { top: 1px; }\n', '.part { top: 2px; }\n', '.part { top: 3px; }\n']);
  });

  it('serves each replacement of a module', async ({ skip }) => {
    skip(!events, NO_EVENTS);
    expect(await served('/part.ts')).toContain('part = 0');
    await follows(join(root, 'part.ts'), '/part.ts', ['export const part = 1;\n', 'export const part = 2;\n', 'export const part = 3;\n']);
  });
});
