import { describe, expect, it } from 'vitest';
import { accessMatch } from './access';
import type { MenuEntry } from './entries';

describe('accessMatch, shrunk', () => {
  it('chooses a row whose letter is declared decomposed by the composed key that types it', () => {
    const entries: MenuEntry[] = [{ kind: 'item', key: 'i0', label: 'x', run: () => {}, access: 'ṩ'.normalize('NFD') }];
    expect(accessMatch(entries, 'ṩ')).toBe(0);
    expect(accessMatch(entries, 's')).toBeNull();
  });
});
