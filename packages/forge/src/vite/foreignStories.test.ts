// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { indexStoryResolved } from './indexStory';
import { createWrapperResolver } from './wrappers';

const ROOT = '/repo';
const STORY = `${ROOT}/src/S.stories.tsx`;
const source = { root: ROOT, stories: ['src/**/*.stories.tsx'] };
const FORGE = `export const meta = (spec) => spec;\nexport const story = (spec) => spec;\n`;
const resolve = async (spec: string) => (spec === '@weasel-js/forge' ? `${ROOT}/forge/index.ts` : `${ROOT}/src/${spec.slice(2)}.ts`);

const exportsOf = async (files: Record<string, string>) => {
  const all: Record<string, string> = { ...files, [`${ROOT}/forge/index.ts`]: FORGE };
  const { entries } = await indexStoryResolved(all[STORY]!, STORY, source, resolve, createWrapperResolver((path) => all[path] ?? ''));
  return entries.map((e) => e.exportName);
};

describe('foreignStories', () => {
  it('settles when imported functions call each other', async () => {
    const files = {
      [STORY]: `import { meta } from '@weasel-js/forge';\nimport { f } from './a';\nexport default meta({ title: 'ui/S' });\nexport const S = f();\n`,
      [`${ROOT}/src/a.ts`]: `import { g } from './b';\nexport function f() { return g(); }\n`,
      [`${ROOT}/src/b.ts`]: `import { f } from './a';\nimport { story } from '@weasel-js/forge';\nexport function g() { return x ? f() : story({}); }\n`,
    };
    const hung = new Promise((settle) => setTimeout(() => settle('hung'), 2000));
    expect(await Promise.race([exportsOf(files), hung])).toEqual(['S']);
  });

  it('answers a function the same whether a deep import chain reached it first', async () => {
    const files: Record<string, string> = {
      [STORY]: `import { meta } from '@weasel-js/forge';\nimport { d0 } from './d0';\nimport { target } from './target';\nexport default meta({ title: 'ui/S' });\nexport const Deep = d0();\nexport const Shallow = target();\n`,
      [`${ROOT}/src/target.ts`]: `import { story } from '@weasel-js/forge';\nexport function target() { return story({}); }\n`,
    };
    for (let i = 0; i < 9; i++) {
      const next = i === 8 ? 'target' : `d${i + 1}`;
      files[`${ROOT}/src/d${i}.ts`] = `import { ${next} } from './${next}';\nexport function d${i}() { return ${next}(); }\n`;
    }
    expect(await exportsOf(files)).toContain('Shallow');
  });

  it('reads an imported alias of story, or a factory that made one, as the same code in the story file reads', async () => {
    const files = {
      [STORY]: `import { meta } from '@weasel-js/forge';\nimport { make, made } from './h';\nexport default meta({ title: 'ui/S' });\nexport const Aliased = make({});\nexport const Factory = made({});\n`,
      [`${ROOT}/src/h.ts`]: `import { story } from '@weasel-js/forge';\nconst factory = () => story;\nexport const make = story;\nexport const made = factory();\n`,
    };
    expect(await exportsOf(files)).toEqual(['Aliased', 'Factory']);
  });
});
