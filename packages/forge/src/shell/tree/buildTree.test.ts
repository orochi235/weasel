import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../../story/types';
import { buildTree, filterTree, type TreeNode } from './buildTree';

const entry = (title: string, name: string): IndexEntry => {
  const id = `${title.toLowerCase().replaceAll('/', '-')}--${name.toLowerCase()}`;
  return { id, title, name, exportName: name, file: '/x.stories.tsx' };
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
