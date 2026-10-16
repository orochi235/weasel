import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { kitSettingsCssOptions } from './kitCss';

const leaf = pref.number('N', 1);

describe('kitSettingsCssOptions', () => {
  it('names a property and an attribute under the kit prefix, kebab-cased', () => {
    const { property, attribute } = kitSettingsCssOptions();
    expect(property!('tree.typeaheadMs', leaf)).toBe('--wzl-kit-tree-typeahead-ms');
    expect(attribute!('look.mode')).toBe('data-wzl-kit-look-mode');
  });

  it('drops the `at` prefix and leaves out a leaf outside it', () => {
    const { property, attribute } = kitSettingsCssOptions('kit');
    expect(property!('kit.tree.typeaheadMs', leaf)).toBe('--wzl-kit-tree-typeahead-ms');
    expect(property!('kitchen.sink', leaf)).toBeNull();
    expect(property!('app.zoom', leaf)).toBeNull();
    expect(attribute!('kit.look.mode')).toBe('data-wzl-kit-look-mode');
    expect(attribute!('app.mode')).toBe('data-wzl-kit-app-mode');
  });
});
