import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterTaken, packSent } from './sent';
import { nodeAt, setAttribute } from './schemaEdit';

const SOURCE: PrefGroup = {
  name: 'Root',
  children: {
    snap: { kind: 'boolean', name: 'Snap', description: '', default: false },
    cut: { kind: 'number', name: 'Cut', description: '', default: 1 },
  },
};

describe('a submission the source has taken', () => {
  const sent = setAttribute(SOURCE, 'snap', 'name', 'Snap to grid');

  it('leaves the source itself when nothing was edited since', () => {
    // The source took the rename, and worded it its own way.
    const taken = setAttribute(SOURCE, 'snap', 'name', 'Snap to the grid');
    expect(afterTaken(sent, packSent(sent, SOURCE), taken)).toBe(taken);
  });

  it('keeps an edit made after the submission, on top of the source that took it', () => {
    const since = setAttribute(sent, 'cut', 'default', 4);
    const next = afterTaken(since, packSent(sent, SOURCE), sent);
    expect(nodeAt(next, 'snap')).toMatchObject({ name: 'Snap to grid' });
    expect(nodeAt(next, 'cut')).toMatchObject({ default: 4 });
  });
});
