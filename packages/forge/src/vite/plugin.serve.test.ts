// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaptureEndpoint } from './capture/endpoint';
import { forge } from './plugin';
import { WATCH_PROBE } from './watchProbe';

const endpoints: (CaptureEndpoint & { close: ReturnType<typeof vi.fn> })[] = [];

vi.mock('./servePages.ts', () => ({
  servePages: () => {
    const endpoint = { revise: vi.fn(), close: vi.fn(async () => {}) };
    endpoints.push(endpoint);
    return endpoint;
  },
}));
vi.mock('./issues/endpoint.ts', () => ({ serveIssues: () => {} }));

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const hook = (h: unknown) => (typeof h === 'function' ? h : (h as { handler: unknown }).handler) as Hook;

const roots: string[] = [];
afterEach(() => {
  endpoints.length = 0;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** forge's own plugin, its config resolved under a fresh root, and a way to hand it a server. */
function drive(stories: string[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-serve-')));
  roots.push(root);
  const plugin = forge({ stories, propControls: false, api: false }).find((p) => p.name === 'weaselforge') as Plugin;
  const plugins = [plugin, { name: WATCH_PROBE }];
  hook(plugin.configResolved).call(undefined, { root, base: '/', logger: { warn() {}, error() {} }, plugins });
  const serve = () => {
    const add = vi.fn();
    hook(plugin.configureServer).call(undefined, { watcher: { add, on() {} }, config: { root, plugins } });
    return add;
  };
  return { root, plugin, serve };
}

describe('forge serving', () => {
  it("watches each story glob's directory outside the root, so a story added there is reported", () => {
    const { root, serve } = drive(['../../packages/*/src/**/*.stories.tsx', './src/**/*.stories.tsx', '../lab/One.stories.tsx']);
    expect(serve().mock.calls[0]?.[0]).toEqual([join(root, '../../packages'), join(root, '../lab')]);
  });
});
