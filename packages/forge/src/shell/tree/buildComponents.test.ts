import { describe, it, expect } from 'vitest';
import { buildComponents, componentNodes, filterComponents, libraryOf } from './buildComponents';
import type { TreeNode } from './buildTree';
import type { IndexEntry } from '../../story/types';

const entry = (title: string, name: string, file: string): IndexEntry => ({
  id: `${title}--${name}`.toLowerCase(),
  title,
  name,
  exportName: name,
  file,
});

const UI = '/repo/packages/ui/src/components/Button/Button.stories.tsx';
const LABKIT = '/repo/packages/labkit/src/primitives/JobProgress.stories.tsx';

describe('libraryOf', () => {
  it('reads the package, not the title prefix', () => {
    // The two title prefixes `packages/ui` actually ships.
    expect(libraryOf(entry('weasel-ui/Foundations/Button', 'Default', UI))).toBe('weasel-ui');
    expect(libraryOf(entry('Primitives/Checkbox', 'Default', UI))).toBe('weasel-ui');
    expect(libraryOf(entry('labkit/Primitives/JobProgress', 'Default', LABKIT))).toBe('labkit');
  });

  it('falls back to the title prefix for a file under no known package', () => {
    expect(libraryOf(entry('Notes/Scratch', 'Default', '/elsewhere/Scratch.stories.tsx'))).toBe('Notes');
  });
});

describe('buildComponents', () => {
  it('collapses every title into one alphabetical list, stories kept', () => {
    const rows = buildComponents([
      entry('weasel-ui/Foundations/Button', 'Default', UI),
      entry('weasel-ui/Foundations/Button', 'Disabled', UI),
      entry('Primitives/Checkbox', 'Default', UI),
      entry('labkit/Primitives/JobProgress', 'Default', LABKIT),
    ]);
    expect(rows.map((r) => `${r.label} [${r.library}]`)).toEqual([
      'Button [weasel-ui]',
      'Checkbox [weasel-ui]',
      'JobProgress [labkit]',
    ]);
    expect(rows[0].entries.map((e) => e.name)).toEqual(['Default', 'Disabled']);
  });

  it('keeps same-named components in different libraries apart', () => {
    const rows = buildComponents([
      entry('weasel-ui/Sidebar', 'Default', UI),
      entry('labkit/Primitives/Sidebar', 'Default', LABKIT),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.library)).toEqual(['labkit', 'weasel-ui']);
  });
});

describe('filterComponents', () => {
  const rows = buildComponents([
    entry('weasel-ui/Foundations/Button', 'Default', UI),
    entry('weasel-ui/Foundations/Button', 'Disabled', UI),
    entry('labkit/Primitives/JobProgress', 'Running', LABKIT),
  ]);

  it('returns everything for an empty query', () => {
    expect(filterComponents(rows, '  ')).toHaveLength(2);
  });

  it('matches on the library tag', () => {
    expect(filterComponents(rows, 'labkit').map((r) => r.label)).toEqual(['JobProgress']);
  });

  it('keeps only the matching stories when the component itself does not match', () => {
    const got = filterComponents(rows, 'disabled');
    expect(got).toHaveLength(1);
    expect(got[0].entries.map((e) => e.name)).toEqual(['Disabled']);
  });
});

describe('componentNodes', () => {
  /** Folders as `label/`, stories as their row label, nested as arrays. */
  const shape = (nodes: readonly TreeNode[]): unknown[] =>
    nodes.map((node) =>
      node.kind === 'folder'
        ? { [`${node.label}/${node.index ? '+' : ''}`]: shape(node.children) }
        : (node.label ?? node.entry.name),
    );

  it('makes every component a folder carrying its index page, one story or many', () => {
    const nodes = componentNodes(
      buildComponents([
        entry('weasel-ui/Foundations/Button', 'Default', UI),
        entry('weasel-ui/Foundations/Button', 'Disabled', UI),
        entry('labkit/Primitives/JobProgress', 'Running', LABKIT),
      ]),
    );
    expect(shape(nodes)).toEqual([
      { 'Button/+': ['Default', 'Disabled'] },
      { 'JobProgress/+': ['Running'] },
    ]);
    expect(nodes[0]?.kind === 'folder' && nodes[0].index?.id).toBe('weasel-ui-foundations-button:index');
  });

  it('keeps the index page of a component the filter names, and not of one matched only by a story', () => {
    const rows = buildComponents([
      entry('weasel-ui/Foundations/Button', 'Default', UI),
      entry('weasel-ui/Foundations/Button', 'Disabled', UI),
    ]);
    expect(shape(componentNodes(filterComponents(rows, 'button')))).toEqual([
      { 'Button/+': ['Default', 'Disabled'] },
    ]);
    expect(shape(componentNodes(filterComponents(rows, 'disabled')))).toEqual([{ 'Button/': ['Disabled'] }]);
  });
});

describe('label disambiguation', () => {
  const UI2 = '/repo/packages/ui/src/components/Icons/Gallery.stories.tsx';

  it('widens colliding labels leftward until they differ', () => {
    const rows = buildComponents([
      entry('weasel-ui/Cursors/Gallery', 'Default', UI),
      entry('weasel-ui/Icons/Gallery', 'Default', UI2),
      entry('weasel-ui/Foundations/Button', 'Default', UI),
    ]);
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(['Button', 'Cursors/Gallery', 'Icons/Gallery']);
  });

  it('leaves same-named components in different libraries alone — the tag tells them apart', () => {
    const rows = buildComponents([
      entry('weasel-ui/Sidebar', 'Default', UI),
      entry('labkit/Primitives/Sidebar', 'Default', LABKIT),
    ]);
    expect(rows.map((r) => [r.label, r.library])).toEqual([
      ['Sidebar', 'labkit'],
      ['Sidebar', 'weasel-ui'],
    ]);
  });

  it('leaves a unique label alone', () => {
    const rows = buildComponents([entry('weasel-ui/Foundations/Button', 'Default', UI)]);
    expect(rows[0].label).toBe('Button');
  });
});
