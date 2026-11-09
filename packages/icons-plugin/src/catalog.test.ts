import { describe, expect, it } from 'vitest';
import { iconCatalog } from './catalog';

const table = (namespace: string) => ({ namespace, owner: 'o', icons: { a: { body: '<path/>', group: 'G', tags: [] } } });
const ctx = {};

describe('iconCatalog', () => {
  it('reads only the variants it was given, not what every object inherits', () => {
    const catalog = iconCatalog({});
    expect(() => catalog.add(ctx, table('constructor'))).not.toThrow();
    expect(catalog.variant(ctx, 'constructor', false)).toEqual([table('constructor')]);
    expect(() => catalog.variant(ctx, 'toString', false)).toThrow(/names no custom variant/);
  });
});
