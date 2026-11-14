import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { toTreeNodes } from './structureRows';

const num = { kind: 'number', name: 'R', description: '', default: 0 } as const;
const ROOT: PrefGroup = {
  name: 'Root',
  children: {
    shape: { kind: 'object', name: 'Shape', description: '', default: {}, children: { r: num } },
    many: { kind: 'list', name: 'Many', description: '', default: [], item: { kind: 'object', name: 'One', description: '', default: {}, children: { r: num } } },
    plain: num,
  },
};

describe('toTreeNodes', () => {
  it('gives every leaf a glyph, with or without fields under it', () => {
    const rows = toTreeNodes(ROOT, null, new Set());
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.shape!.leading).toBeTruthy();
    expect(byId.shape!.children).toHaveLength(1);
    expect(byId.many!.leading).toBeTruthy();
    expect(byId.plain!.leading).toBeTruthy();
  });
});
