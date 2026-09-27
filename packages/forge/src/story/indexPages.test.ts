import { describe, expect, it } from 'vitest';
import { indexEntries } from './indexPages';
import type { IndexEntry } from './types';

const entry = (title: string, name: string, tags?: string[]): IndexEntry => ({
  id: `${title}--${name}`,
  title,
  name,
  exportName: name,
  file: '/x.stories.tsx',
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
