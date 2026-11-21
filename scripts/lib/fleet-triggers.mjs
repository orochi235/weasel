/**
 * Changes that reach tests with no import edge to follow: a branch changing any of these runs
 * everything (`branchChanges` in `fleet-tree.mjs`). A test file is never one: `related` finds it.
 */

/** Read by npm, tsc, onto or vitest itself rather than imported. */
export const INPUTS = ['**/package.json', 'package-lock.json', '**/tsconfig*.json', '.onto/tests', 'vitest.config.ts'];

/**
 * What `vitest.config.ts`, the run's launcher and the setup files load, and nothing else: a plugin
 * only a dev server or a build loads (`scripts/vite-site-proxy.ts`) reaches only the tests that
 * import it. `fleet-triggers.test.ts` fails on a loaded file none of these covers, and on one these
 * cover that nothing loads.
 */
export const LOADED = [
  'vitest.*setup.ts',
  'packages/labkit/src/test-setup.ts',
  'scripts/*.setup.ts',
  'scripts/vite-{aliases,build-info,demo-sources,demo-timestamps,get-started,package-docs,prebundle,prebundle-reach,prebundle-stars,watch}.ts',
  'scripts/vitest-{browser-commands,browser-deps,browser-overlay,browser-prebundle,css-cache-key,load-reruns,own-frame,resolve-cache-key,timeout-retries}.ts',
  'scripts/vitest-{browser-spread,fleet-fail,first-sequencer,overlap}.mjs',
  'scripts/{chromium-gpu-args,headless-source}.ts',
  'scripts/lib/{browser-shape,fleet-first,fleet-tree,fleet-triggers,imports,load-reruns,merge-progress,module-cache,node-load,own-install,packageEntries,prune-older-than,workspaces}.mjs',
  'scripts/lib/{cssBlocks,markdownBlocks}.ts',
  'scripts/release/{changelogs,entry-marker,summary,vite-plugin}.ts',
  'scripts/release/bumps.mjs',
  'typedoc/packageOptions.mjs',
  'apps/draw/vite-plugin-{callback-source,source-index,trait-schemas}.ts',
  'apps/draw/vite-plugin-{source-index,trait-schemas}/*.ts',
  'apps/forge/viteShared.ts',
  'packages/forge/src/vite/{ast,autoTitle,bindings,componentGraph,componentOf,componentReach,foreignStories,forgeTest,indexFile,indexStory,moduleInfo,nativeExports,ownEntries,ownKeys,storyGlob,storybookShims,trace,watchRecovery,watchSettle,wrappers}.ts',
  'packages/icons-plugin/src/{annotate,bundlers,catalog,collect,index,parse,rewrite,scope,tables,virtual,walk}.ts',
];

export const TRIGGERS = [...INPUTS, ...LOADED];

/**
 * The triggers one workspace or app owns: a branch changing one runs that package's tests and its
 * dependents' instead of everything. No config here loads them; the root and `packages/` ones stay global.
 */
export const SCOPED = [
  'packages/*/package.json',
  'apps/*/package.json',
  'packages/*/tsconfig*.json',
  '{packages,apps}/*/{vitest,vite}.config.*',
  'apps/*/tsconfig*.json',
];

/** A test file, which `related` reaches on its own and so never runs everything. */
export const isTestFile = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
