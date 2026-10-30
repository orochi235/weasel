import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ViteDevServer } from 'vite';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { bundledDirs, restartLeavingNothing, sourcedFromBundled, storyServing, sourcePackages, specifiersIn, specifiersUnder, type Workspace } from './vite-prebundle';
import { pathImportsIn } from './vite-prebundle-reach';

const tree = mkdtempSync(join(tmpdir(), 'vite-prebundle-'));
afterAll(() => rmSync(tree, { recursive: true, force: true }));

function file(path: string, code: string): void {
  mkdirSync(join(tree, path, '..'), { recursive: true });
  writeFileSync(join(tree, path), code);
}

describe('specifiersIn', () => {
  it('finds static, re-exported and dynamic workspace imports, and leaves stylesheets out', () => {
    const code = [
      "import { a } from '@weasel-js/core';",
      "export { b } from '@weasel-js/ui/components/Icon';",
      "const c = await import('@editor/index');",
      "import '@weasel-js/theme/tokens.css';",
      "import React from 'react';",
    ].join('\n');
    expect(specifiersIn(code)).toEqual(['@weasel-js/core', '@weasel-js/ui/components/Icon', '@editor/index']);
  });

  it('takes no specifier out of a template string', () => {
    expect(specifiersIn("const id = import('@weasel-js/labkit${sub}');")).toEqual([]);
  });
});

describe('specifiersUnder', () => {
  // Built from pieces: vite-aliases.test.ts fails on any repo import that resolves to no file.
  const unresolvable = (name: string) => `import { z } from '${'@weasel-js'}/${name}';`;
  file('app/src/main.tsx', "import { x } from '@weasel-js/core';");
  file('app/src/deep/panel.ts', "import { y } from '@weasel-js/geom';");
  file('app/src/main.test.tsx', unresolvable('testing-only'));
  file('app/src/Panel.stories.tsx', unresolvable('story-only'));
  file('app/node_modules/dep/index.js', unresolvable('vendored'));

  it('reads shipped source only, skipping tests, stories and node_modules', () => {
    expect([...specifiersUnder([join(tree, 'app')])].sort()).toEqual(['@weasel-js/core', '@weasel-js/geom']);
  });

  it('reads stories too when asked', () => {
    expect([...specifiersUnder([join(tree, 'app')], true)].sort()).toEqual([
      '@weasel-js/core',
      '@weasel-js/geom',
      '@weasel-js/story-only',
    ]);
  });
});

const ws: Workspace = {
  dirs: new Map([
    ['@weasel-js/geom', '/repo/packages/geom'],
    ['@weasel-js/core', '/repo/packages/core'],
    ['@weasel-js/ui', '/repo/packages/ui'],
    ['@weasel-js/labkit', '/repo/packages/labkit'],
  ]),
  deps: new Map([
    ['@weasel-js/geom', []],
    ['@weasel-js/core', ['@weasel-js/geom']],
    ['@weasel-js/ui', ['@weasel-js/core']],
    ['@weasel-js/labkit', ['@weasel-js/ui', '@weasel-js/core']],
  ]),
};

describe('sourcePackages', () => {
  it('serves no package from source for an app whose own trees hold none', () => {
    expect(sourcePackages(ws, ['/repo/apps/chart/src'])).toEqual(new Set());
  });

  it('serves a package holding a source tree, and every package that depends on it', () => {
    expect(sourcePackages(ws, ['/repo/packages/ui/src'])).toEqual(new Set(['@weasel-js/ui', '@weasel-js/labkit']));
  });
});

describe('bundledDirs', () => {
  it('bundles every package and every shared app source', () => {
    expect(bundledDirs('/repo', ['/repo/apps/chart/src', '/repo/apps/shared'], ws, new Set())).toEqual([
      '/repo/packages/geom',
      '/repo/packages/core',
      '/repo/packages/ui',
      '/repo/packages/labkit',
      '/repo/apps/draw/src',
      '/repo/apps/shared/editor/src',
    ]);
  });

  it('leaves out the app itself and the packages served from source', () => {
    const dirs = bundledDirs('/repo', ['/repo/apps/draw/src'], ws, new Set(['@weasel-js/ui', '@weasel-js/labkit']));
    expect(dirs).toEqual(['/repo/packages/geom', '/repo/packages/core', '/repo/apps/shared/editor/src']);
  });
});

describe('pathImportsIn', () => {
  it('finds what a file loads by path, leaving out what is erased', () => {
    const code = [
      "import { a } from './a';",
      "import type { B } from './b';",
      "import { type C } from './c';",
      "export { d } from '../d';",
      "export type { E } from './e';",
      "import './f.css';",
      "const g = await import('./g');",
      "import h from 'h';",
      "import { i } from 'core/scene/i';",
      "import type { J } from 'interactions/j';",
      "import { k } from 'corer/k';",
    ].join('\n');
    expect(pathImportsIn(code)).toEqual(['./a', './c', '../d', './f.css', './g', 'core/scene/i']);
  });
});

describe('sourcedFromBundled', () => {
  file('pkg/src/Widget.tsx', "import { shape } from './shape';\nexport const Widget = shape;");
  file('pkg/src/shape.ts', "import { leaf } from './leaf';\nexport const shape = leaf;");
  file('pkg/src/leaf.ts', 'export const leaf = 1;');
  file('pkg/src/types.ts', 'export type T = number;');
  file('pkg/src/Widget.stories.tsx', "import { shape } from './shape';\nimport type { T } from './types';\nimport { helper } from '../../app/helper';");
  file('pkg/src/other.ts', 'export const other = 2;');
  file('app/helper.ts', "import { other } from '../pkg/src/other';\nexport const helper = other;");

  it('takes each bundled module a story reaches by path, and what that module reaches in turn, but not through a tree outside', () => {
    const sourced = sourcedFromBundled([join(tree, 'pkg/src/Widget.stories.tsx')], [join(tree, 'pkg')]);
    expect([...sourced].map((f) => f.slice(tree.length + 1)).sort()).toEqual([
      'pkg/src/Widget.stories.tsx',
      'pkg/src/leaf.ts',
      'pkg/src/shape.ts',
    ]);
  });
});

describe('storyServing', () => {
  it('serves story trees from source by default, so their packages keep HMR', () => {
    expect(storyServing(['/repo/apps/forge'], ['/repo/packages/ui/src'], {})).toEqual({
      sourceDirs: ['/repo/apps/forge', '/repo/packages/ui/src'],
      storyTrees: [],
    });
  });

  it('bundles their packages under WEASEL_DEV_BUNDLE_STORIES=1', () => {
    expect(storyServing(['/repo/apps/forge'], ['/repo/packages/ui/src'], { WEASEL_DEV_BUNDLE_STORIES: '1' })).toEqual({
      sourceDirs: ['/repo/apps/forge'],
      storyTrees: ['/repo/packages/ui/src'],
    });
  });
});

/** An environment shaped like vite's: what `PartialEnvironment` holds, then the module graph and its holders. */
function environment(name: string) {
  const env: Record<string, unknown> = {
    name,
    _options: { optimizeDeps: {} },
    _topLevelConfig: { cacheDir: '/cache' },
    logger: { info: vi.fn() },
    moduleGraph: { modules: new Map() },
    _pluginContainer: {},
    _pendingRequests: new Map(),
    _crawlEndFinder: {},
    hot: {},
    depsOptimizer: {},
  };
  env.config = new Proxy(env._options as object, {
    get: (target, prop) => (prop in target ? (env._options as Record<PropertyKey, unknown>)[prop] : (env._topLevelConfig as Record<PropertyKey, unknown>)[prop]),
  });
  return env;
}

/** A server whose restart swaps in new environments, as vite's does, while a dep optimizer run of the old one is still in flight. */
function serverWithOptimizerRun() {
  const outgoing = { client: environment('client') };
  const server = { environments: outgoing as Record<string, object> } as unknown as ViteDevServer;
  const client = outgoing.client as { logger: { info: (m: string) => void }; config: { cacheDir: string } };
  // vite's runOptimizeDeps: a 1 s timer that announces a slow run, and the run reading its environment as it goes.
  setTimeout(() => client.logger.info('[optimizer] bundling dependencies...'), 1000);
  const run = new Promise<string>((done) => setTimeout(() => done(client.config.cacheDir), 3000));
  server.restart = async () => { (server as { environments: object }).environments = { client: environment('client') }; };
  return { server, outgoing, run };
}

describe('restartLeavingNothing', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('leaves a closed environment what a dep optimizer run still in flight reads', async () => {
    vi.useFakeTimers();
    const { server, outgoing, run } = serverWithOptimizerRun();
    const client = outgoing.client;
    await restartLeavingNothing(server);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(run).resolves.toBe('/cache');
    expect(client.logger.info).toHaveBeenCalledWith('[optimizer] bundling dependencies...');
  });

  it('drops the closed environment from the server and empties its module graph and holders', async () => {
    vi.useFakeTimers();
    const { server, outgoing } = serverWithOptimizerRun();
    const client = outgoing.client;
    await restartLeavingNothing(server);
    expect(outgoing).toEqual({});
    expect(Object.keys(client).sort()).toEqual(['_options', '_topLevelConfig', 'config', 'logger', 'name']);
  });
});
