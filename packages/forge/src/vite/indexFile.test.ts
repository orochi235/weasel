import { describe, expect, it } from 'vitest';
import { foreignCallees, indexFile } from './indexFile';

const FILE = '/repo/packages/ui/src/Slider.stories.tsx';

const ids = (code: string, file = FILE) => indexFile(code, file, 'ui/Auto').map((e) => [e.id, e.name]);

describe('indexFile', () => {
  it('indexes a native meta and its stories', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider' });
export const Basic = story({ render: () => null });
export const WithName = story({ name: 'Custom name', render: () => null });
`;
    expect(indexFile(code, FILE, 'ui/Auto')).toEqual([
      { id: 'ui-slider--basic', title: 'ui/Slider', name: 'Basic', exportName: 'Basic', file: FILE },
      { id: 'ui-slider--withname', title: 'ui/Slider', name: 'Custom name', exportName: 'WithName', file: FILE },
    ]);
  });

  it('takes what it is told about a native file\'s imports over its own guess', () => {
    const code = `
import { meta } from '@weasel-js/forge';
import { Shared, LIMIT, sized, rowsOf, Unknown } from './shared';
export default meta({ title: 'ui/Slider' });
export { Shared, LIMIT, Unknown };
export const Small = sized(1);
export const rows = rowsOf(3);
export { Other, table } from './other';
`;
    const foreign = {
      value: (name: string) => ({ Shared: true, LIMIT: false })[name],
      call: (name: string) => ({ sized: true, rowsOf: false })[name],
      reexport: (name: string) => ({ Other: true, table: false })[name],
    };
    expect(indexFile(code, FILE, 'ui/Auto', new Set(), foreign).map((e) => e.exportName)).toEqual(['Shared', 'Unknown', 'Small', 'Other']);
  });

  it('reads a native export that picks between values, or copies one, by what it picks from', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider' });
const Basic = story({ render: () => null });
const options = { dense: true };
export const Copy = { ...Basic, name: 'A copy' };
export const settings = { ...options, wide: true };
export const Either = flag ? Basic : Copy;
export const limit = flag ? 4 : 8;
export const Fallback = maybe ?? Basic;
`;
    expect(ids(code).map(([, name]) => name)).toEqual(['A copy', 'Either', 'Fallback']);
  });

  it('leaves out of a native file the exports that cannot be stories, which the loader skips', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
import { Shared } from './shared.stories';
export default meta({ title: 'ui/Slider' });
export const rows = [1, 2, 3];
const LIMIT = 4 as const;
export { LIMIT, Shared };
export function helper() { return null; }
export const Basic = story({ render: () => null });
export const Copy = { ...Basic, name: 'A copy' };
export const Either = flag ? Basic : Copy;
export { Other } from './other.stories';
`;
    expect(ids(code)).toEqual([
      ['ui-slider--shared', 'Shared'],
      ['ui-slider--basic', 'Basic'],
      ['ui-slider--copy', 'A copy'],
      ['ui-slider--either', 'Either'],
      ['ui-slider--other', 'Other'],
    ]);
  });

  it('leaves out of a native file an export that is a call to anything but story, which the loader skips', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
import { makeRows } from './rows';
export default meta({ title: 'ui/Slider' });
export const rows = makeRows();
export const count = [1, 2].map(String);
const sized = (size: number) => story({ render: () => size });
function named(name: string) {
  return story({ name, render: () => null });
}
const table = () => makeRows();
export const Small = sized(1);
export const Named = named('x');
export const data = table();
export const Basic = story({ render: () => null });
`;
    expect(ids(code)).toEqual([
      ['ui-slider--small', 'Small'],
      ['ui-slider--named', 'Named'],
      ['ui-slider--basic', 'Basic'],
    ]);
  });

  it('reads a CSF title written as a constant or a template with no expression, and falls back to the auto title otherwise', () => {
    const titled = (title: string) => ids(`const TITLE = 'ui/Const';\nexport default { title: ${title} };\nexport const A = {};\n`)[0]?.[0];
    expect(titled('TITLE')).toBe('ui-const--a');
    expect(titled('TITLE as string')).toBe('ui-const--a');
    expect(titled('`ui/Tpl`')).toBe('ui-tpl--a');
    expect(titled('`ui/${name}`')).toBe('ui-auto--a');
    expect(titled('imported')).toBe('ui-auto--a');
  });

  it('indexes CSF with a typed meta constant and call-built stories', () => {
    const csf = `
import type { Meta, StoryObj } from '@storybook/react-vite';
const meta: Meta<typeof Lab> = {
  title: 'labkit/Lab/Fit',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Lab>;
export const FullscreenWide = fit('fullscreen', 'wide');
export const Named: Story = { name: 'A named one', render: () => null };
`;
    expect(ids(csf)).toEqual([
      ['labkit-lab-fit--fullscreenwide', 'Fullscreen Wide'],
      ['labkit-lab-fit--named', 'A named one'],
    ]);
  });

  it('reads a meta constant written with satisfies', () => {
    const code = `
const meta = { title: 'ui/Button' } satisfies Meta<typeof Button>;
export default meta;
export const Primary = {};
`;
    expect(ids(code)).toEqual([['ui-button--primary', 'Primary']]);
  });

  it('reads a default export cast with as', () => {
    const code = `
export default { title: 'ui/Badge' } as Meta;
export const Small = { storyName: 'Tiny' };
`;
    expect(ids(code)).toEqual([['ui-badge--small', 'Tiny']]);
  });

  it('indexes export specifiers in declaration order', () => {
    const code = `
export default { title: 'ui/Tag' };
const B = {};
const A = {};
export { B, A as Renamed };
`;
    expect(ids(code)).toEqual([
      ['ui-tag--b', 'B'],
      ['ui-tag--renamed', 'Renamed'],
    ]);
  });

  it('indexes an exported function as a story', () => {
    const code = `
export default { title: 'ui/Tag' };
export function Plain() { return null; }
`;
    expect(ids(code)).toEqual([['ui-tag--plain', 'Plain']]);
  });

  it('skips __namedExportsOrder and type exports', () => {
    const code = `
export default { title: 'ui/Tag' };
export const One = {};
export type Two = {};
export interface Three {}
export const __namedExportsOrder = ['One'];
`;
    expect(ids(code)).toEqual([['ui-tag--one', 'One']]);
  });

  it('honors excludeStories', () => {
    const code = `
export default { title: 'ui/Tag', excludeStories: ['helper'] };
export const helper = () => null;
export const Shown = {};
`;
    expect(ids(code)).toEqual([['ui-tag--shown', 'Shown']]);
  });

  it('honors includeStories', () => {
    const code = `
export default { title: 'ui/Tag', includeStories: ['Shown'] };
export const helper = () => null;
export const Shown = {};
`;
    expect(ids(code)).toEqual([['ui-tag--shown', 'Shown']]);
  });

  it('honors a regex excludeStories', () => {
    const code = `
export default { title: 'ui/Tag', excludeStories: /.*Data$/ };
export const mockData = {};
export const Shown = {};
`;
    expect(ids(code)).toEqual([['ui-tag--shown', 'Shown']]);
  });

  it('titles with the auto title when the meta names none', () => {
    const code = `
export default {};
export const Basic = {};
`;
    expect(indexFile(code, FILE, 'ui/Auto')[0]?.title).toBe('ui/Auto');
  });

  it('gives a file without a default export no entries', () => {
    expect(ids(`export const Basic = {};`)).toEqual([]);
  });

  it('reads an angle-bracket cast in a .stories.ts file', () => {
    const code = `
export default <any>{ title: 'ui/Cast' };
export const Basic = <any>{};
`;
    expect(ids(code, '/repo/packages/ui/src/Cast.stories.ts')).toEqual([['ui-cast--basic', 'Basic']]);
  });

  it('parses JSX in a .tsx file and legacy decorators anywhere', () => {
    const code = `
@sealed
class Helper {}
export default { title: 'ui/Jsx' };
export const Basic = { render: () => <div /> };
`;
    expect(ids(code)).toEqual([['ui-jsx--basic', 'Basic']]);
  });

  it('harvests the component identifier and the JSDoc above the meta and each story', () => {
    const code = `
/**
 * A slider.
 * Drag it.
 */
export default { title: 'ui/Slider', component: Slider };
/** The plain one. */
export const Basic = {};
// Not JSDoc, so not a blurb.
export const Terse = {};
`;
    const [basic, terse] = indexFile(code, FILE, 'ui/Auto');
    expect(basic).toMatchObject({
      componentName: 'Slider',
      componentDescription: 'A slider.\nDrag it.',
      description: 'The plain one.',
    });
    expect(terse).not.toHaveProperty('description');
    expect(terse).toMatchObject({ componentName: 'Slider' });
  });

  it('leaves entries alone in a file with no comments', () => {
    const code = `
export default { title: 'ui/Bare' };
export const Basic = {};
`;
    expect(indexFile(code, FILE, 'ui/Auto')).toEqual([
      { id: 'ui-bare--basic', title: 'ui/Bare', name: 'Basic', exportName: 'Basic', file: FILE },
    ]);
  });

  describe('viewport', () => {
    const viewports = (code: string) => indexFile(code, FILE, 'ui/Auto').map((e) => e.viewport);

    it("reads a native story's viewport written as number literals, and nothing else", () => {
      const code = `
import { meta, story } from '@weasel-js/forge';
const size = { width: 1, height: 2 };
export default meta({ title: 'ui/Slider' });
export const Literal = story({ viewport: { width: 320, height: 200 }, render: () => null });
export const Bound = story({ viewport: size, render: () => null });
export const Computed = story({ viewport: { width: 2 * 160, height: 200 }, render: () => null });
export const None = story({ render: () => null });
`;
      expect(viewports(code)).toEqual([{ width: 320, height: 200 }, { width: 1, height: 2 }, undefined, undefined]);
    });

    it('reads no viewport off a CSF story, whose viewport comes from its parameters and globals', () => {
      const code = `
export default { title: 'ui/Button' };
export const A = { viewport: { width: 320, height: 200 } };
`;
      expect(viewports(code)).toEqual([undefined]);
    });
  });

  describe('isolate', () => {
    const isolates = (code: string) => indexFile(code, FILE, 'ui/Auto').map((e) => e.isolate);

    it('reads it off a native story', () => {
      const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider' });
export const Basic = story({ isolate: 'imports a global stylesheet', render: () => null });
export const Plain = story({ render: () => null });
`;
      expect(isolates(code)).toEqual(['imports a global stylesheet', undefined]);
    });

    it('inherits it from a native meta, with the story winning', () => {
      const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider', isolate: \`whole file\` });
export const Basic = story({ render: () => null });
export const Own = story({ isolate: 'its own reason', render: () => null });
`;
      expect(isolates(code)).toEqual(['whole file', 'its own reason']);
    });

    it('reads parameters.forge.isolate off a CSF story and its meta', () => {
      const code = `
export default { title: 'ui/Button', parameters: { forge: { isolate: 'meta reason' } } };
export const FromMeta = {};
export const FromStory = { parameters: { forge: { isolate: 'story reason' } } };
`;
      expect(isolates(code)).toEqual(['meta reason', 'story reason']);
    });

    it('refuses a value that is not a string literal, naming the file and export', () => {
      const code = `
export default { title: 'ui/Button' };
export const Basic = { parameters: { forge: { isolate: REASON } } };
`;
      expect(() => indexFile(code, FILE, 'ui/Auto')).toThrow(`${FILE}: Basic: isolate must be a string literal`);
      const template = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider', isolate: \`because \${why}\` });
export const Basic = story({ render: () => null });
`;
      expect(() => indexFile(template, FILE, 'ui/Auto')).toThrow(`${FILE}: default: isolate must be a string literal`);
    });

    it('leaves the key off an entry with none', () => {
      const code = `
export default { title: 'ui/Button', parameters: { forge: {} } };
export const Basic = {};
`;
      expect(indexFile(code, FILE, 'ui/Auto')[0]).not.toHaveProperty('isolate');
    });
  });

  describe('tags', () => {
    const tags = (code: string) => indexFile(code, FILE, 'ui/Auto').map((e) => e.tags);

    it('gives every story the meta’s tags, from a CSF meta or a native one', () => {
      expect(tags(`export default { title: 'ui/All', tags: ['gallery', 'autodocs'] };\nexport const A = {};\nexport const B = {};\n`)).toEqual([
        ['gallery', 'autodocs'],
        ['gallery', 'autodocs'],
      ]);
      const native = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/All', tags: ['gallery'] });
export const Basic = story({ render: () => null });
`;
      expect(tags(native)).toEqual([['gallery']]);
    });

    it('adds a story’s own tags to the meta’s, and drops one a story negates, as Storybook does', () => {
      const code = `
export default { title: 'ui/Route', tags: ['a', 'b'] };
export const Default = {};
export const AllPermutations = { tags: ['gallery', '!b'] };
`;
      expect(tags(code)).toEqual([['a', 'b'], ['a', 'gallery']]);
      expect(tags(`export default { title: 'ui/Route' };\nexport const A = { tags: ['gallery'] };\n`)).toEqual([['gallery']]);
    });

    it('reads only string literals, and leaves the key off a meta with none', () => {
      expect(tags(`export default { title: 'ui/All', tags: ['gallery', NAME] };\nexport const A = {};\n`)).toEqual([['gallery']]);
      expect(indexFile(`export default { title: 'ui/All' };\nexport const A = {};\n`, FILE, 'ui/Auto')[0]).not.toHaveProperty('tags');
    });
  });

  it('names the file when a title cannot make an id', () => {
    const code = `
export default { title: '!!!' };
export const Basic = {};
`;
    expect(() => indexFile(code, FILE, 'ui/Auto')).toThrow(FILE);
  });
});

describe('a meta and stories built by a helper module', () => {
  const code = `
import { meta as defineMeta, story } from './forge-helpers';
import { Thing } from './Thing';
import type { Spec } from './types';
export default defineMeta({ title: 'ui/Thing', component: Thing });
const basic = story({ name: 'The basic one', render: () => null });
export { basic as Basic };
export const Plain = {};
`;

  it('reads the meta only once told the helper is forge', () => {
    expect(ids(code)).toEqual([
      ['ui-auto--basic', 'Basic'],
      ['ui-auto--plain', 'Plain'],
    ]);
    expect(indexFile(code, FILE, 'ui/Auto', new Set(['defineMeta', 'story'])).map((e) => [e.id, e.name, e.componentName])).toEqual([
      ['ui-thing--basic', 'The basic one', 'Thing'],
    ]);
  });

  it('names the imports the exports are calls to, and nothing else', () => {
    expect(foreignCallees(code, FILE)).toEqual([
      { local: 'defineMeta', spec: './forge-helpers', imported: 'meta' },
      { local: 'story', spec: './forge-helpers', imported: 'story' },
    ]);
  });

  it('leaves out calls to forge itself', () => {
    expect(foreignCallees(`import { meta } from '@weasel-js/forge';\nexport default meta({ title: 'ui/X' });\n`, FILE)).toEqual([]);
  });
});
