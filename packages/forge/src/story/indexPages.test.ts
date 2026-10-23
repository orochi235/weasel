import { describe, expect, it } from 'vitest';
import { byComponent, indexEntries, primaryFile } from './indexPages';
import type { IndexEntry } from './types';

const entry = (title: string, name: string, tags?: string[], file = '/x.stories.tsx'): IndexEntry => ({
  id: `${title}--${name}`,
  title,
  name,
  exportName: name,
  file,
  ...(tags ? { tags } : {}),
});

describe('indexEntries', () => {
  it('gives an index page the tags every story of its component carries', () => {
    const [page, other] = indexEntries([
      entry('ui/A', 'One', ['gallery', 'x']),
      entry('ui/A', 'Two', ['gallery']),
      entry('ui/B', 'One', ['gallery']),
      entry('ui/B', 'Two'),
    ]);
    expect(page?.tags).toEqual(['gallery']);
    expect(other).not.toHaveProperty('tags');
  });
});

describe('a title several files share', () => {
  const lab = entry('ui/Bar', 'OnAnArc', ['lab'], '/c/Bar/lab/BarArc.stories.tsx');
  const own = entry('ui/Bar', 'Default', undefined, '/c/Bar/Bar.stories.tsx');

  it("is spoken for by the file named for the title's last segment, else by the first", () => {
    expect(primaryFile('ui/Bar', [lab.file, own.file])).toBe(own.file);
    expect(primaryFile('ui/Bar', [lab.file, '/c/Other.stories.tsx'])).toBe(lab.file);
  });

  it('lists that file first, and its index page takes the file and description from it', () => {
    const described = { ...own, componentDescription: 'A bar.', componentName: 'Bar' };
    const other = entry('ui/Tabs', 'Default');
    expect(byComponent([lab, other, described]).map((e) => e.id)).toEqual([described.id, lab.id, other.id]);
    const [page] = indexEntries([{ ...lab, componentDescription: 'A lab.' }, described]);
    expect(page).toMatchObject({ file: own.file, componentDescription: 'A bar.', componentName: 'Bar' });
    expect(page).not.toHaveProperty('tags');
  });
});
