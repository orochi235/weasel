// @vitest-environment node
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig, TransformResult } from 'vite';
import { describe, expect, it } from 'vitest';
import { forgeTest } from './forgeTest';

const ROOT = '/repo';

function transformer(options: Parameters<typeof forgeTest>[0]) {
  const plugins = forgeTest(options);
  const main = plugins.find((p) => p.name === 'weaselforge:test') as Plugin;
  (main.configResolved as (c: ResolvedConfig) => void)({ root: ROOT } as ResolvedConfig);
  const transform = main.transform as (code: string, id: string) => Promise<TransformResult | string | undefined>;
  return async (code: string, id: string, resolve: (spec: string) => string | null = () => null) => {
    const context = { resolve: async (spec: string) => (resolve(spec) === null ? null : { id: resolve(spec) }) };
    const out = await transform.call(context, code, id);
    return typeof out === 'object' && out !== null ? out.code : out;
  };
}

const source = `import { f, meta, story } from '@weasel-js/forge';
export default meta({ title: 'forge/Counter' });
export const Counter = story({ render: () => null });
export const Named = story({ name: 'With "quotes"', render: () => null });
`;

describe('forgeTest', () => {
  it('appends one test per indexed story, calling runStory on the module itself', async () => {
    const file = `${ROOT}/apps/x/Counter.stories.tsx`;
    const code = await transformer({ stories: ['apps/**/*.stories.tsx'] })(source, file);
    expect(code).toBeDefined();
    expect(code).toContain(source);
    expect(code).toContain(`import { runStory as __forge_runStory } from "@weasel-js/forge/test";`);
    expect(code).toContain(`import "@weasel-js/forge/shell.css";`);
    expect(code).toContain(`import "@weasel-js/forge/frame.css";`);
    expect(code?.match(/__forge_test\(/g)).toHaveLength(2);
    expect(code).toContain(`const __forge_file = ${JSON.stringify(file)};`);
    expect(code).toContain('const __forge_title = "forge/Counter";');
    expect(code).toContain(
      'const __forge_run = async (exportName) => __forge_runStory(await import(/* @vite-ignore */ import.meta.url), exportName, __forge_file, __forge_title, __forge_options);',
    );
    expect(code).toContain('__forge_test("Counter", () => __forge_run("Counter"), __forge_timeout);');
    expect(code).toContain(`__forge_test(${JSON.stringify('With "quotes"')}, () => __forge_run("Named"), __forge_timeout);`);
  });

  it("titles and isolates stories whose meta reaches forge through a project helper, as the workshop's index does", async () => {
    const helper = fileURLToPath(new URL('../story/define.ts', import.meta.url));
    const wrapped = `import { meta as defineMeta, story } from './helpers';
export default defineMeta({ title: 'forge/Wrapped', isolate: 'needs a document' });
export const One = story({ render: () => null });
`;
    const code = await transformer({ stories: ['apps/**/*.stories.tsx'] })(wrapped, `${ROOT}/apps/x/Wrapped.stories.tsx`, () => helper);
    expect(code).toContain('const __forge_title = "forge/Wrapped";');
    expect(code).toContain('__forge_test.skip("One (isolated: needs a document)", () => {});');
  });

  it('skips an isolated story, naming the reason, since the test page is no document of its own', async () => {
    const file = `${ROOT}/apps/x/Edge.stories.tsx`;
    const isolated = `import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'forge/Edge' });
export const Plain = story({ render: () => null });
export const Edge = story({ isolate: 'asserts placement against the window edge', render: () => null });
`;
    const code = await transformer({ stories: ['apps/**/*.stories.tsx'] })(isolated, file);
    expect(code).toContain('__forge_test("Plain", () => __forge_run("Plain"), __forge_timeout);');
    expect(code).toContain('__forge_test.skip("Edge (isolated: asserts placement against the window edge)", () => {});');
    expect(code).not.toContain('__forge_run("Edge")');
  });

  it('keeps every test line short, whatever the file path', async () => {
    const file = `${ROOT}/${'deeply/'.repeat(20)}Counter.stories.tsx`;
    const code = (await transformer({ stories: ['**/*.stories.tsx'] })(source, file)) ?? '';
    const tests = code.split('\n').filter((line) => line.startsWith('__forge_test('));
    expect(tests).toHaveLength(2);
    for (const line of tests) expect(line).not.toContain(file);
  });

  // A page resize is a round trip through Playwright, which took 7 to 13 s on a loaded fleet node; runStory sizes the
  // story's box instead.
  it('never resizes the browser page', async () => {
    const code = await transformer({ stories: ['*.stories.tsx'] })(source, `${ROOT}/a.stories.tsx`);
    expect(code).not.toContain('vitest/browser');
  });

  it('hands the frame config module to every story', async () => {
    const code = await transformer({ stories: ['*.stories.tsx'], frameConfig: 'forge.frame.tsx' })(source, `${ROOT}/a.stories.tsx`);
    expect(code).toContain(`import __forge_frame_config from "${ROOT}/forge.frame.tsx";`);
    expect(code).toContain('setup: __forge_frame_config,');
  });

  it('runs stories with no setup when there is no frame config', async () => {
    const code = await transformer({ stories: ['*.stories.tsx'] })(source, `${ROOT}/a.stories.tsx`);
    expect(code).not.toContain('__forge_frame_config');
    expect(code).toContain('setup: undefined,');
  });

  it('leaves files outside the globs, and query-suffixed ids, alone', async () => {
    const run = transformer({ stories: ['apps/**/*.stories.tsx'] });
    expect(await run(source, `${ROOT}/packages/x/Counter.stories.tsx`)).toBeUndefined();
    expect(await run(source, `${ROOT}/apps/x/Counter.stories.tsx?raw`)).toBeUndefined();
    expect(await run(source, `${ROOT}/apps/node_modules/x/Counter.stories.tsx`)).toBeUndefined();
  });

  it('matches a glob written with a leading ./', async () => {
    const code = await transformer({ stories: ['./apps/**/*.stories.tsx'] })(source, `${ROOT}/apps/x/Counter.stories.tsx`);
    expect(code).toContain('__forge_test(');
  });

  it('leaves a story file with no stories alone', async () => {
    expect(await transformer({ stories: ['*.stories.tsx'] })('export const x = 1;\n', `${ROOT}/a.stories.tsx`)).toBeUndefined();
  });

  // The imports runStory reaches are appended by transform, which vite's dependency scan never runs, so a cold
  // cache discovers react-dom/client mid-run, re-optimizes, reloads the page and fails with a second React.
  it('points the dependency scan at the stories, the frame config and its own test runtime', () => {
    const main = forgeTest({ stories: ['apps/**/*.stories.tsx'], frameConfig: 'forge.frame.tsx' }).find(
      (p) => p.name === 'weaselforge:test',
    ) as Plugin;
    const config = (main.config as (c: { root?: string }) => { optimizeDeps?: { entries?: string[] } })({ root: ROOT });
    const entries = config.optimizeDeps?.entries ?? [];
    expect(entries.slice(0, 2)).toEqual(['apps/**/*.stories.tsx', `${ROOT}/forge.frame.tsx`]);
    expect(entries.some((e) => /[/\\]test[/\\]index\.(ts|js)$/.test(e))).toBe(true);
  });

  it('includes the storybook preview-api shims', () => {
    expect(forgeTest({ stories: [] }).map((p) => p.name)).toContain('weaselforge:storybook-shims');
  });
});
