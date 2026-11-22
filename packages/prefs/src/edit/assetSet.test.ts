import type { PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { pointer } from '../testing/editAssetSet';
import { headingOf, withRoots, type LayoutAsset, type SchemaAsset } from './assetSet';

const layout = (root: PrefGroup): LayoutAsset => ({ id: 'l', label: 'L', kind: 'layout', over: 's', root });
const menu = (children: PrefGroup['children'] = {}): PrefGroup => ({ name: 'Edit', as: 'menu', children });

describe('where the asset list files a layout', () => {
  it('files a menu root under Menus', () => {
    expect(headingOf(layout(menu({ copy: pointer('copy') })))).toBe('Menus');
  });

  it('files a bar of menus under Menus', () => {
    expect(headingOf(layout({ name: '', as: 'bar', children: { file: menu(), edit: menu() } }))).toBe('Menus');
  });

  it('files a bar of menus and one action under Toolbars', () => {
    expect(headingOf(layout({ name: '', as: 'bar', children: { file: menu(), copy: pointer('copy') } }))).toBe('Toolbars');
  });

  it('files an empty bar under Toolbars', () => {
    expect(headingOf(layout({ name: '', as: 'bar', children: {} }))).toBe('Toolbars');
  });
});

describe('withRoots', () => {
  it("takes back an asset's root and keeps what the host has said of it since", () => {
    const [before, after]: PrefGroup[] = [{ name: 'A', children: {} }, { name: 'B', children: {} }];
    const stepped: SchemaAsset = { id: 's', label: 'S', kind: 'schema', root: before };
    const current: SchemaAsset = { ...stepped, nodeKind: 'rect', root: after };
    expect(withRoots({ assets: [current] }, { assets: [stepped] }).assets[0]).toEqual({ ...current, root: before });
  });

  it('hands back the step itself where the host has said nothing since', () => {
    const stepped = { assets: [layout(menu())] };
    expect(withRoots({ assets: [layout(menu({ copy: pointer('copy') }))] }, stepped)).toBe(stepped);
  });
});
