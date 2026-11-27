// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReadApi } from './apiTable';
import { propControls } from './propControls';

const API: ReadApi = {
  props: [{ name: 'label', type: 'string', required: true }],
  inherited: [],
  ref: null,
  sources: [],
  component: { name: 'Chip', file: '/repo/Chip.ts' },
};

vi.mock('./propTypes.ts', () => ({ createPropReader: async () => ({ read: () => null, api: () => API }) }));

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const hook = (h: unknown) => (typeof h === 'function' ? h : (h as { handler: unknown }).handler) as Hook;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('propControls serving', () => {
  it("reloads a story served before TypeDoc's JSON existed once the JSON is written", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-typedoc-')));
    roots.push(root);
    const story = join(root, 'Chip.stories.tsx');
    const plugin = propControls(() => [story], () => undefined, { controls: false, api: true });
    hook(plugin.configResolved).call(undefined, { root, command: 'serve' });
    const reloadModule = vi.fn(async () => {});
    hook(plugin.configureServer).call(undefined, {
      environments: { client: { moduleGraph: { getModuleById: (id: string) => ({ id }) }, reloadModule } },
      config: { logger: { error() {} } },
    });
    const addWatchFile = vi.fn();
    try {
      await hook(plugin.transform).call({ warn() {}, addWatchFile }, '', story);
      mkdirSync(join(root, 'dist'));
      writeFileSync(join(root, 'dist/typedoc.json'), '{}');
      await vi.waitFor(() => expect(reloadModule).toHaveBeenCalledWith({ id: story }), { timeout: 8000, interval: 50 });
    } finally {
      await hook(plugin.closeServer).call(undefined);
    }
  });
});
