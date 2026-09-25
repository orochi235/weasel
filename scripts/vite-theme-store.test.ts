import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoredTheme } from '../packages/theme/src/store';
import type { ThemeStore } from './theme-store';
import { handleThemeRequest, themeStorePlugin } from './vite-theme-store';

const weasel: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: { name: 'weasel' } };
const fakeStore = (write: ThemeStore['write'] = vi.fn()): ThemeStore => ({
  list: () => [weasel],
  read: (name) => (name === 'weasel' ? weasel : undefined),
  write,
});
const base = '/weasel/theme-editor/__theme';

describe('handleThemeRequest', () => {
  it('ignores every path outside /__theme/<name>', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', '/weasel/theme-editor/index.html', null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/../weasel`, null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/Weasel.json`, null)).toBeUndefined();
  });

  it('lists and reads', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/list`, null)).toEqual({ status: 200, body: { themes: [weasel] } });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/weasel`, null)).toEqual({ status: 200, body: weasel });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/nope`, null)?.status).toBe(404);
  });

  it('answers a conflict with 409 and passes the hash through', () => {
    const write = vi.fn(() => ({ status: 'conflict', hash: 'h2' }) as const);
    const out = handleThemeRequest(fakeStore(write), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' }, hash: 'h1' });
    expect(write).toHaveBeenCalledWith('weasel', { name: 'weasel' }, 'h1');
    expect(out).toEqual({ status: 409, body: { status: 'conflict', hash: 'h2' } });
  });

  it('refuses a body without a definition and a hash', () => {
    expect(handleThemeRequest(fakeStore(), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' } })?.status).toBe(400);
  });
});

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

describe('themeStorePlugin', () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let root: string | null = null;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  /** The plugin's middleware over a temp copy of weasel.json, and a request through it. */
  function serve() {
    root = mkdtempSync(resolve(tmpdir(), 'wzl-theme-plugin-'));
    mkdirSync(resolve(root, 'themes'));
    copyFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), resolve(root, 'themes/weasel.json'));
    let middleware: Middleware | undefined;
    const server = { middlewares: { use: (m: Middleware) => (middleware = m) } } as unknown as ViteDevServer;
    const plugin = themeStorePlugin({ themesDir: resolve(root, 'themes'), extraFiles: [], generatedDir: resolve(root, 'generated') });
    (plugin.configureServer as (s: ViteDevServer) => void)(server);
    const request = (method: string, url: string, body?: unknown) =>
      new Promise<{ status: number; body: unknown } | 'next'>((done) => {
        const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), { method, url }) as unknown as IncomingMessage;
        const res = {
          statusCode: 0,
          setHeader: () => undefined,
          end(text: string) {
            done({ status: this.statusCode, body: JSON.parse(text) });
          },
        } as unknown as ServerResponse;
        middleware!(req, res, () => done('next'));
      });
    return { request, file: resolve(root, 'themes/weasel.json') };
  }

  it('passes on every other path', async () => {
    expect(await serve().request('GET', '/index.html')).toBe('next');
  });

  it('saves a PUT carrying the file’s hash, and refuses a stale one without writing', async () => {
    const { request, file } = serve();
    const got = (await request('GET', '/__theme/weasel')) as { body: StoredTheme };
    const definition = { ...got.body.definition, description: 'edited' };
    const before = readFileSync(file, 'utf8');

    expect(await request('PUT', '/__theme/weasel', { definition, hash: 'stale' })).toEqual({
      status: 409,
      body: { status: 'conflict', hash: got.body.hash },
    });
    expect(readFileSync(file, 'utf8')).toBe(before);

    const saved = await request('PUT', '/__theme/weasel', { definition, hash: got.body.hash });
    expect(saved).toMatchObject({ status: 200, body: { status: 'saved', regenerated: true } });
    expect(JSON.parse(readFileSync(file, 'utf8')).description).toBe('edited');
  });
});
