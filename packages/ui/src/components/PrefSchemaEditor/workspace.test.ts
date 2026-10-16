import type { PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { pointer } from './workspace.fixtures';
import { headingOf, type LayoutAsset } from './workspace';

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
