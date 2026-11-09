import { describe, expect, it } from 'vitest';
import { iconParts, iconSpecRefs, toIconSpec, type IconRef } from './index';

const ref = (s: string) => s as IconRef;

describe('icon specs', () => {
  it('reads a bare ref as a subject with no mark', () => {
    expect(iconParts(ref('core:tune'))).toEqual({ name: 'core:tune' });
    expect(iconParts(undefined)).toBeUndefined();
  });

  it('lists the refs a spec names, subject first', () => {
    expect(iconSpecRefs({ name: ref('core:tune'), mark: ref('ui:markAdd') })).toEqual(['core:tune', 'ui:markAdd']);
    expect(iconSpecRefs(ref('core:tune'))).toEqual(['core:tune']);
    expect(iconSpecRefs(undefined)).toEqual([]);
  });

  it('reads a spec from data, refusing any part that is not qualified', () => {
    expect(toIconSpec('core:tune')).toBe('core:tune');
    expect(toIconSpec({ name: 'core:tune', mark: 'ui:markAdd' })).toEqual({ name: 'core:tune', mark: 'ui:markAdd' });
    expect(toIconSpec({ name: 'core:tune' })).toEqual({ name: 'core:tune' });
    expect(toIconSpec('tune')).toBeUndefined();
    expect(toIconSpec({ name: 'core:tune', mark: 'markAdd' })).toBeUndefined();
    expect(toIconSpec({ mark: 'ui:markAdd' })).toBeUndefined();
    expect(toIconSpec(null)).toBeUndefined();
    expect(toIconSpec(3)).toBeUndefined();
  });
});
