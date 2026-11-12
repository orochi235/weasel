// @vitest-environment node
// A package edit restarts a dev server with its config loaded through vite's module runner
// (`restartLeavingNothing`), which closes once the config has loaded. Each module here loads something
// lazily, so each is imported the same way and its loader is called after the runner has closed.
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runnerImport } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const load = async <T>(path: string) => (await runnerImport<T>(join(root, path), { logLevel: 'silent' })).module;

describe('lazy loads in a config the module runner evaluated', () => {
  let dir: string;
  const before = process.env.WAKE_PATH;

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'runner-lazy-')));
  });

  afterAll(() => {
    if (before === undefined) delete process.env.WAKE_PATH;
    else process.env.WAKE_PATH = before;
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads wake', async () => {
    writeFileSync(join(dir, 'wake.mjs'), "export function wake() { return { name: 'fake-wake' }; }\n");
    process.env.WAKE_PATH = join(dir, 'wake.mjs');
    const { localWake } = await load<typeof import('./vite-wake.ts')>('scripts/vite-wake.ts');
    expect(localWake()?.name).toBe('fake-wake');
  });

  it("loads TypeScript for forge's prop controls", async () => {
    writeFileSync(join(dir, 'tsconfig.json'), '{}');
    const { createPropReader } = await load<typeof import('../packages/forge/src/vite/propTypes.ts')>(
      'packages/forge/src/vite/propTypes.ts',
    );
    expect(await createPropReader(dir, () => [])).not.toBeNull();
  });

  it("loads Playwright for forge's capture", async () => {
    const { captureAvailability, INSTALL_PLAYWRIGHT } = await load<typeof import('../packages/forge/src/vite/capture/browser.ts')>(
      'packages/forge/src/vite/capture/browser.ts',
    );
    expect(await captureAvailability()).not.toEqual({ unavailable: INSTALL_PLAYWRIGHT });
  });
});
