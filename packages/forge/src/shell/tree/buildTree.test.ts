import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../../story/types';
import { buildTree, filterTree, type TreeNode } from './buildTree';

const entry = (title: string, name: string, tags?: string[]): IndexEntry => {
  const id = `${title.toLowerCase().replaceAll('/', '-')}--${name.toLowerCase()}`;
  return { id, title, name, exportName: name, file: '/x.stories.tsx', ...(tags ? { tags } : {}) };
};

/** Folders as `label/`, with a `+` when they carry an index page; stories as their name; nested as arrays. */
function shape(nodes: readonly TreeNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === 'folder' ? { [`${node.label}/${node.index ? '+' : ''}`]: shape(node.children) } : node.entry.name,
  );
}

describe('buildTree', () => {
  it('nests titles by their segments, with each component holding its stories', () => {
    const tree = buildTree([entry('Kit/Button', 'Primary'), entry('Kit/Button', 'Ghost'), entry('Kit/Slider', 'Default')]);
    expect(shape(tree)).toEqual([
      { 'Kit/': [{ 'Button/+': ['Primary', 'Ghost'] }, { 'Slider/+': ['Default'] }] },
    ]);
  });

  it('gives each folder the path of the segments that reach it', () => {
    const [kit] = buildTree([entry('Kit/Button', 'Primary')]);
    expect(kit?.kind === 'folder' && kit.path).toBe('Kit');
    const button = kit?.kind === 'folder' ? kit.children[0] : undefined;
    expect(button?.kind === 'folder' && button.path).toBe('Kit/Button');
  });

  it('gives each component folder its index page, and a folder no component has none', () => {
    const [kit] = buildTree([entry('Kit/Button', 'Primary')]);
    expect(kit?.kind === 'folder' && kit.index).toBeUndefined();
    const button = kit?.kind === 'folder' ? kit.children[0] : undefined;
    expect(button?.kind === 'folder' && button.index).toMatchObject({ id: 'kit-button:index', name: 'Index' });
    expect(button?.kind === 'folder' && button.children.map((n) => n.kind === 'story' && n.entry.name)).toEqual(['Primary']);
  });

  it('sorts folders before stories and folders alphabetically, keeping stories in index order', () => {
    const tree = buildTree([
      entry('Zed', 'Second'),
      entry('Zed/Inner', 'Only'),
      entry('Zed', 'First'),
      entry('Alpha', 'One'),
    ]);
    expect(shape(tree)).toEqual([
      { 'Alpha/+': ['One'] },
      { 'Zed/+': [{ 'Inner/+': ['Only'] }, 'Second', 'First'] },
    ]);
  });
});

describe('buildTree galleries', () => {
  const gallery = (title: string, name: string) => entry(title, name, ['gallery']);

  it('folds a folder holding only a gallery into the gallery, so its stories sit one level below it', () => {
    const tree = buildTree([gallery('ui/Cursors/Gallery', 'Hotspots'), gallery('ui/Cursors/Gallery', 'Rotations')]);
    expect(shape(tree)).toEqual([{ 'ui/': [{ 'Cursors/+': ['Hotspots', 'Rotations'] }] }]);
    const cursors = tree[0]?.kind === 'folder' ? tree[0].children[0] : undefined;
    // The gallery's own path and index page, so its story ids and route ancestors are unchanged.
    expect(cursors?.kind === 'folder' && cursors.path).toBe('ui/Cursors/Gallery');
    expect(cursors?.kind === 'folder' && cursors.index?.id).toBe('ui-cursors-gallery:index');
    expect(cursors?.kind === 'folder' && cursors.index?.tags).toEqual(['gallery']);
  });

  it('leaves a gallery alone when its folder holds anything else', () => {
    const tree = buildTree([gallery('ui/Properties/Gallery', 'All'), entry('ui/Properties/Panel', 'Default')]);
    expect(shape(tree)).toEqual([{ 'ui/': [{ 'Properties/': [{ 'Gallery/+': ['All'] }, { 'Panel/+': ['Default'] }] }] }]);
  });

  it('does not fold a lone component that is not a gallery', () => {
    expect(shape(buildTree([entry('ui/Cursors/Gallery', 'Default')]))).toEqual([
      { 'ui/': [{ 'Cursors/': [{ 'Gallery/+': ['Default'] }] }] },
    ]);
  });

  it('does not fold a gallery into a folder that is itself a component', () => {
    const tree = buildTree([entry('ui/Kit', 'Default'), gallery('ui/Kit/Gallery', 'All')]);
    expect(shape(tree)).toEqual([{ 'ui/': [{ 'Kit/+': [{ 'Gallery/+': ['All'] }, 'Default'] }] }]);
  });

  it('keeps the folded gallery findable by its folder name and its own', () => {
    const tree = buildTree([gallery('ui/Cursors/Gallery', 'Hotspots'), entry('ui/Button', 'Default')]);
    expect(shape(filterTree(tree, 'cursors'))).toEqual([{ 'ui/': [{ 'Cursors/+': ['Hotspots'] }] }]);
    expect(shape(filterTree(tree, 'hotspots'))).toEqual([{ 'ui/': [{ 'Cursors/': ['Hotspots'] }] }]);
  });
});

describe('filterTree', () => {
  const tree = buildTree([entry('Kit/Button', 'Primary'), entry('Kit/Button', 'Ghost'), entry('Kit/Slider', 'Default')]);

  it('keeps a story whose title and name contain the query, with its ancestors', () => {
    expect(shape(filterTree(tree, 'ghost'))).toEqual([{ 'Kit/': [{ 'Button/': ['Ghost'] }] }]);
  });

  it('matches across the title and the name', () => {
    expect(shape(filterTree(tree, 'SLIDER/def'))).toEqual([{ 'Kit/': [{ 'Slider/': ['Default'] }] }]);
  });

  it('keeps the index page of a component the query names, and matches nothing by the page’s own name', () => {
    expect(shape(filterTree(tree, 'button'))).toEqual([{ 'Kit/': [{ 'Button/+': ['Primary', 'Ghost'] }] }]);
    expect(shape(filterTree(tree, 'index'))).toEqual([]);
  });

  it('drops folders left with nothing in them', () => {
    expect(filterTree(tree, 'nothing matches this')).toEqual([]);
  });

  it('returns the tree unchanged for an empty query', () => {
    expect(filterTree(tree, '')).toBe(tree);
  });
});
