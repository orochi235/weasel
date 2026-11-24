import { describe, expect, it } from 'vitest';
import { foreignCallees, indexFile } from './indexFile';

const FILE = '/repo/packages/ui/src/Slider.stories.tsx';

const ids = (code: string, file = FILE) => indexFile(code, file, 'ui/Auto').map((e) => [e.id, e.name]);

describe('indexFile', () => {
  it('takes the auto-title for an empty meta title, as Storybook does', () => {
    const code = `const TITLE = '';\nexport default { title: TITLE };\nexport const A = {};\n`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => [e.id, e.title])).toEqual([['ui-auto--a', 'ui/Auto']]);
  });

  it('reads no value from a top-level let or var the file reassigns', () => {
    const code = `let title = 'ui/A';\ntitle = 'ui/B';\nvar kept = 'ui/C';\nexport default { title };\nexport const S = { name: kept };\n`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => [e.title, e.name])).toEqual([['ui/Auto', 'ui/C']]);
  });

  it('names a component written as a member of an import', () => {
    const code = `import * as Tabs from './Tabs';\nexport default { component: Tabs.Panel };\nexport const A = {};\n`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => e.componentName)).toEqual(['Tabs.Panel']);
  });

  it('reads a file importing forge as a namespace as native', () => {
    const code = `
import * as forge from '@weasel-js/forge';
export default forge.meta({ title: 'ui/Slider' });
export const helper = 3;
export const A = forge.story({ name: 'Named', viewport: { width: 400, height: 300 }, render: () => null });
`;
    expect(indexFile(code, FILE, 'ui/Auto')).toEqual([
      { id: 'ui-slider--a', title: 'ui/Slider', name: 'Named', exportName: 'A', file: FILE, viewport: { width: 400, height: 300 } },
    ]);
  });

  it("makes ids from a meta's id, as Storybook does, and keeps the title for the tree", () => {
    const code = `const ID = 'custom';\nexport default { title: 'Example/Page', id: ID };\nexport const LoggedIn = {};\n`;
    expect(indexFile(code, FILE, 'ui/Auto')).toEqual([
      { id: 'custom--logged-in', title: 'Example/Page', metaId: 'custom', name: 'Logged In', exportName: 'LoggedIn', file: FILE },
    ]);
  });

  it('indexes a native meta and its stories', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider' });
export const Basic = story({ render: () => null });
export const WithName = story({ name: 'Custom name', render: () => null });
`;
    expect(indexFile(code, FILE, 'ui/Auto')).toEqual([
      { id: 'ui-slider--basic', title: 'ui/Slider', name: 'Basic', exportName: 'Basic', file: FILE },
      { id: 'ui-slider--with-name', title: 'ui/Slider', name: 'Custom name', exportName: 'WithName', file: FILE },
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
    expect(indexFile(code, FILE, 'ui/Auto', new Map(), foreign).map((e) => e.exportName)).toEqual(['Shared', 'Unknown', 'Small', 'Other']);
  });

  it('keeps a native export that calls an import nothing decided, as it keeps the import itself', () => {
    const code = `
import { meta } from '@weasel-js/forge';
import { made, Taken } from './helpers';
export default meta({ title: 'ui/Slider' });
export const Made = made();
export const Curried = made()();
export const Inline = (() => story({}))();
export const settings = (() => 4)();
export { Taken };
`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => e.exportName)).toEqual(['Made', 'Curried', 'Inline', 'Taken']);
    const foreign = { value: () => undefined, call: () => undefined, reexport: () => undefined };
    expect(indexFile(code, FILE, 'ui/Auto', new Map(), foreign).map((e) => e.exportName)).toEqual(['Made', 'Curried', 'Inline', 'Taken']);
  });

  it('follows a helper\'s returns into try, switch, loops and labeled blocks', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
export default meta({ title: 'ui/Slider' });
function tried() { try { return story({}); } catch { return null; } }
function caught() { try { throw 1; } catch { return story({}); } }
function finished() { try { } finally { return story({}); } }
function switched(k) { switch (k) { case 1: return story({}); default: return null; } }
function looped(xs) { for (const x of xs) { return story({ x }); } return null; }
function labeled() { out: { return story({}); } }
function rows() { try { return [1]; } finally { } }
export const Tried = tried();
export const Caught = caught();
export const Finished = finished();
export const Switched = switched(1);
export const Looped = looped([1]);
export const Labeled = labeled();
export const data = rows();
`;
    expect(ids(code).map(([, name]) => name)).toEqual(['Tried', 'Caught', 'Finished', 'Switched', 'Looped', 'Labeled']);
  });

  it('leaves out of a native file a second meta, which the loader skips as no story', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
import { defineMeta, defineStory } from './helpers';
export default meta({ title: 'ui/Slider' });
export const Shared = meta({ title: 'ui/Base' });
export const Helped = defineMeta({ title: 'ui/Other' });
export const Basic = story({});
export const Made = defineStory({});
`;
    const wrappers = new Map([['defineMeta', 'meta'], ['defineStory', 'story']] as const);
    expect(indexFile(code, FILE, 'ui/Auto', wrappers).map((e) => e.exportName)).toEqual(['Basic', 'Made']);
  });

  it('reads a key a later spread may override from what the spread carries, and past a spread it cannot read', () => {
    const titled = (head: string) =>
      indexFile(`${head}\nexport const A = { name: 'Mine', ...base };\nconst base = { name: 'Base' };\n`, FILE, 'ui/Auto').map((e) => [e.title, e.name]);
    expect(titled(`const shared = { title: 'ui/Shared' };\nexport default { title: 'ui/Own', ...shared };`)).toEqual([['ui/Shared', 'Base']]);
    expect(titled(`const shared = { tags: [] };\nexport default { title: 'ui/Own', ...shared };`)).toEqual([['ui/Own', 'Base']]);
    expect(titled(`import { shared } from './shared';\nexport default { title: 'ui/Own', ...shared };`)).toEqual([['ui/Own', 'Base']]);
    expect(titled(`import { shared } from './shared';\nexport default { ...shared, title: 'ui/Own' };`)).toEqual([['ui/Own', 'Base']]);
  });

  it('reads no value past a later getter or method of the same key, as the object holds what that one gives', () => {
    const code = `export default { title: 'ui/A', get title() { return 'ui/B'; } };\nexport const S = { name: 'x', name() { return 'y'; } };\n`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => [e.title, e.name])).toEqual([['ui/Auto', 'S']]);
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

  it("leaves out of a native file a local class or enum exported by name, and reads a destructured local's method as no global's", () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
import { load } from './load';
export default meta({ title: 'ui/Slider' });
class Harness {}
enum Mode { A }
const { make } = load();
export { Harness, Mode };
export const Made = make.story();
export const Basic = story({ render: () => null });
`;
    expect(ids(code)).toEqual([
      ['ui-slider--made', 'Made'],
      ['ui-slider--basic', 'Basic'],
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
    const foreign = { value: () => undefined, call: (name: string) => (name === 'makeRows' ? false : undefined), reexport: () => undefined };
    expect(indexFile(code, FILE, 'ui/Auto', new Map(), foreign).map((e) => [e.id, e.name])).toEqual([
      ['ui-slider--small', 'Small'],
      ['ui-slider--named', 'Named'],
      ['ui-slider--basic', 'Basic'],
    ]);
  });

  it('keeps a native export copied by Object.assign from a story, or made by a call it cannot read', () => {
    const code = `
import { meta, story } from '@weasel-js/forge';
import * as forge from '@weasel-js/forge';
import { storyFactory } from './factory';
export default meta({ title: 'ui/Slider' });
const Basic = story({ render: () => null });
const make = storyFactory();
export const Dark = Object.assign({}, Basic, { name: 'Dark' });
export const settings = Object.assign({}, { dense: true });
export const Spaced = forge.story({ render: () => null });
export const Made = make({ render: () => null });
export const keys = [1, 2].map(String);
export const list = Array.from({ length: 2 });
`;
    expect(ids(code).map(([, name]) => name)).toEqual(['Dark', 'Spaced', 'Made']);
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
      ['labkit-lab-fit--fullscreen-wide', 'Fullscreen Wide'],
      ['labkit-lab-fit--named', 'A named one'],
    ]);
  });

  it('reads a story name written as a template literal or a top-level const, as the module does when it runs', () => {
    const code = `
const LABEL = 'From a const';
export default { title: 'ui/Slider' };
export const Templated = { name: \`A template\`, render: () => null };
export const Constant = { name: LABEL, render: () => null };
export const Old = () => null;
Old.storyName = LABEL;
`;
    expect(ids(code)).toEqual([
      ['ui-slider--templated', 'A template'],
      ['ui-slider--constant', 'From a const'],
      ['ui-slider--old', 'From a const'],
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

  it('honors includeStories and excludeStories held in top-level consts', () => {
    const code = `
const HIDDEN = ['helper'];
const SHOWN = /^Sh/;
export default { title: 'ui/Tag', excludeStories: HIDDEN, includeStories: SHOWN };
export const Shown = {};
export const helper = {};
export const Other = {};
`;
    expect(indexFile(code, FILE, 'ui/Auto').map((e) => e.exportName)).toEqual(['Shown']);
    const named = `const NAME = 'Other';\nexport default { title: 'ui/Tag', excludeStories: [NAME] };\nexport const Shown = {};\nexport const Other = {};\n`;
    expect(indexFile(named, FILE, 'ui/Auto').map((e) => e.exportName)).toEqual(['Shown']);
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
const W = 320;
export const Sides = story({ viewport: { width: W, height: 400 as number }, render: () => null });
`;
      expect(viewports(code)).toEqual([{ width: 320, height: 200 }, { width: 1, height: 2 }, undefined, undefined, { width: 320, height: 400 }]);
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

    it('reads a CSF2 story’s name and parameters assigned after it, the last assignment winning', () => {
      const code = `
export default { title: 'ui/Button' };
export const Primary = () => null;
Primary.storyName = 'First';
Primary.storyName = 'Main';
Primary.parameters = { forge: { isolate: 'assigned reason' } };
export const Plain = { storyName: 'Kept' };
`;
      expect(ids(code)).toEqual([['ui-button--primary', 'Main'], ['ui-button--plain', 'Kept']]);
      expect(isolates(code)).toEqual(['assigned reason', undefined]);
    });

    it('reads assignments to a CSF2 story exported under another name', () => {
      const code = `
const Base = () => null;
Base.storyName = 'Nice';
Base.parameters = { forge: { isolate: 'assigned reason' } };
export default { title: 'ui/Button' };
export { Base as Primary };
`;
      expect(ids(code)).toEqual([['ui-button--primary', 'Nice']]);
      expect(isolates(code)).toEqual(['assigned reason']);
    });

    it('reads a reason held in a top-level const', () => {
      const code = `
const REASON = 'shared reason';
export default { title: 'ui/Button' };
export const Basic = { parameters: { forge: { isolate: REASON } } };
`;
      expect(isolates(code)).toEqual(['shared reason']);
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

    it('reads a meta’s negated tag as a removal, never as a tag', () => {
      expect(tags(`export default { title: 'ui/Neg', tags: ['autodocs', '!test'] };\nexport const A = {};\nexport const B = { tags: ['test'] };\n`)).toEqual([
        ['autodocs'],
        ['autodocs', 'test'],
      ]);
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

    it('reads tags held in top-level consts, as it reads a title', () => {
      const code = `
const TAGS = ['gallery', '!test'];
const LAB = 'lab';
export default { title: 'ui/All', tags: TAGS };
export const A = { tags: [LAB, 'test'] as const };
`;
      expect(tags(code)).toEqual([['gallery', 'lab', 'test']]);
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
    expect(indexFile(code, FILE, 'ui/Auto', new Map([['defineMeta', 'meta'], ['story', 'story']] as const)).map((e) => [e.id, e.name, e.componentName])).toEqual([
      ['ui-thing--basic', 'The basic one', 'Thing'],
    ]);
  });

  it('names the imports the exports are calls to, and nothing else', () => {
    expect(foreignCallees(code, FILE)).toEqual([
      { local: 'defineMeta', spec: './forge-helpers', imported: 'meta' },
      { local: 'story', spec: './forge-helpers', imported: 'story' },
    ]);
  });

  it('names a namespace import of a helper module by the member called', () => {
    const ns = `import * as kit from './kit';\nexport default kit.meta({ title: 'ui/X' });\nexport const A = kit.story({});\n`;
    expect(foreignCallees(ns, FILE)).toEqual([
      { local: 'kit.meta', spec: './kit', imported: 'meta' },
      { local: 'kit.story', spec: './kit', imported: 'story' },
    ]);
  });

  it('leaves out calls to forge itself', () => {
    expect(foreignCallees(`import { meta } from '@weasel-js/forge';\nexport default meta({ title: 'ui/X' });\n`, FILE)).toEqual([]);
  });
});
