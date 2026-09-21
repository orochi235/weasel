import { describe, expect, it } from 'vitest';
import { indexFile } from './indexFile';

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

  it('names the file when a title cannot make an id', () => {
    const code = `
export default { title: '!!!' };
export const Basic = {};
`;
    expect(() => indexFile(code, FILE, 'ui/Auto')).toThrow(FILE);
  });
});
