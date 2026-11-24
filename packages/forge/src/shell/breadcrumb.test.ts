import { describe, expect, it } from 'vitest';
import { indexId, INDEX_NAME } from '../story/indexPages';
import { breadcrumb, crumbs } from './breadcrumb';

const story = (title: string, name: string) => ({ id: `${title}--${name}`, title, name });
const indexPage = (title: string) => ({ id: indexId(title), title, name: INDEX_NAME });

describe('breadcrumb', () => {
  it('separates the title segments and the name with >', () => {
    expect(breadcrumb(story('Primitives/Select', 'At The Top Edge'))).toBe('Primitives > Select > At The Top Edge');
  });

  it('leaves out an index segment, but not a lone one', () => {
    expect(breadcrumb(story('Icons/index', 'Grid'))).toBe('Icons > Grid');
    expect(breadcrumb(story('index', 'Grid'))).toBe('index > Grid');
  });

  it('gives a component’s index page the place its title names, and a story named Index a step of its own', () => {
    expect(crumbs(indexPage('Comp/Button'))).toEqual([
      { label: 'Comp', path: 'Comp' },
      { label: 'Button', path: 'Comp/Button' },
    ]);
    expect(breadcrumb(indexPage('Icons'))).toBe('Icons');
    expect(crumbs(story('Comp/Button', 'Index'))).toEqual([
      { label: 'Comp', path: 'Comp' },
      { label: 'Button', path: 'Comp/Button' },
      { label: 'Index', path: null },
    ]);
  });

  it('gives each title segment the tree path it names, and the story none', () => {
    expect(crumbs(story('ui/Icons/index', 'Grid'))).toEqual([
      { label: 'ui', path: 'ui' },
      { label: 'Icons', path: 'ui/Icons' },
      { label: 'Grid', path: null },
    ]);
  });

  it('lets the last segment stand for a story whose name only restates it', () => {
    expect(breadcrumb(story('labkit/ControlPanel/Heading control', 'Heading Control'))).toBe(
      'labkit > ControlPanel > Heading control',
    );
    expect(crumbs(story('labkit/Heading control', 'Heading Control'))).toEqual([
      { label: 'labkit', path: 'labkit' },
      { label: 'Heading control', path: null },
    ]);
  });
});
