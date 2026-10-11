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
