import { describe, it, expect } from 'vitest';
import { itemListFaceOf } from './domItemList';

describe('itemListFaceOf', () => {
  it('reads a null empty state as the default dash ItemList draws for it', () => {
    expect(itemListFaceOf({ props: { rows: [], empty: null } }).empty).toBeUndefined();
    expect(itemListFaceOf({ props: { rows: [] } }).empty).toBeUndefined();
    expect(itemListFaceOf({ props: { rows: [], empty: 'None' } }).empty).toBe('None');
  });
});
