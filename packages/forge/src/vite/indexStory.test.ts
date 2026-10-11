// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { indexStory, indexStoryResolved } from './indexStory';
import { createWrapperResolver } from './wrappers';

const ROOT = '/repo';
const FILE = `${ROOT}/src/Thing.stories.tsx`;
const source = { root: ROOT, stories: ['src/**/*.stories.tsx'] };

const files: Record<string, string> = {
  [FILE]: `
import { meta as defineMeta, story } from './helpers';
export default defineMeta({ title: 'ui/Thing', isolate: 'needs its own document' });
export const Basic = story({ render: () => null });
`,
  [`${ROOT}/src/helpers.ts`]: `export { meta, story } from '@weasel-js/forge';\n`,
  [`${ROOT}/forge/index.ts`]: `export const meta = (spec) => spec;\nexport const story = (spec) => spec;\n`,
};
const resolve = async (spec: string) =>
  spec === '@weasel-js/forge' ? `${ROOT}/forge/index.ts` : spec === './helpers' ? `${ROOT}/src/helpers.ts` : null;
const decide = () => createWrapperResolver((path) => files[path] ?? '');

describe('indexStory', () => {
  it('titles a file whose meta it cannot read from its place under the story globs', () => {
    expect(indexStory(files[FILE] as string, FILE, source).map((e) => [e.id, e.isolate])).toEqual([['thing--basic', undefined]]);
  });
});

describe('indexStoryResolved', () => {
  it("reads a meta and stories that reach forge through a project helper, the helper's isolate included", async () => {
    const { entries, resolution } = await indexStoryResolved(files[FILE] as string, FILE, source, resolve, decide());
    expect(entries.map((e) => [e.id, e.isolate])).toEqual([['ui-thing--basic', 'needs its own document']]);
    expect([...resolution.wrappers].sort()).toEqual(['defineMeta', 'story']);
  });
});

describe('indexStoryResolved, following what a native file imports', () => {
  const STORY = `${ROOT}/src/Mixed.stories.tsx`;
  const mixed: Record<string, string> = {
    [STORY]: `
import { meta, story } from '@weasel-js/forge';
import { Shared, LIMIT, sized, rowsOf } from './shared';
export default meta({ title: 'ui/Mixed' });
export { Shared, LIMIT };
export const Small = sized(1);
export const rows = rowsOf(3);
export { Other, table } from './other';
export const Own = story({ render: () => null });
`,
    [`${ROOT}/src/shared.ts`]: `
import { story as declare } from './helpers';
export const Shared = declare({ render: () => null });
export const LIMIT = 4;
export const sized = (size) => declare({ render: () => size });
export function rowsOf(n) { return Array.from({ length: n }); }
`,
    [`${ROOT}/src/other.ts`]: `
import { sized } from './shared';
export const Other = sized(2);
export const table = [1, 2];
`,
    [`${ROOT}/src/helpers.ts`]: files[`${ROOT}/src/helpers.ts`] as string,
    [`${ROOT}/forge/index.ts`]: files[`${ROOT}/forge/index.ts`] as string,
  };
  const resolveMixed = async (spec: string) =>
    spec === '@weasel-js/forge' ? `${ROOT}/forge/index.ts` : spec.startsWith('./') ? `${ROOT}/src/${spec.slice(2)}.ts` : null;

  it('lists an imported or re-exported story and one an imported factory built, nothing else it imports, and names every file that decided it', async () => {
    const { entries, resolution } = await indexStoryResolved(
      mixed[STORY] as string,
      STORY,
      source,
      resolveMixed,
      createWrapperResolver((path) => mixed[path] ?? ''),
    );
    expect(entries.map((e) => e.exportName)).toEqual(['Shared', 'Small', 'Other', 'Own']);
    expect([...resolution.reads].sort()).toEqual(
      [`${ROOT}/forge/index.ts`, `${ROOT}/src/helpers.ts`, `${ROOT}/src/other.ts`, `${ROOT}/src/shared.ts`].sort(),
    );
  });
});
