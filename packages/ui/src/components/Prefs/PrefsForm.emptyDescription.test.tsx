import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';
import s from './Prefs.module.css';

const leaf: PrefLeaf = { kind: 'boolean', name: 'On', description: '', default: false };
const schema: PrefGroup = {
  name: '',
  children: {
    page: {
      name: 'Page',
      description: '',
      children: {
        section: { name: 'Section', description: '', children: { on: leaf } },
        one: { name: 'One', as: 'tab', description: '', children: { on: leaf } },
        two: { name: 'Two', as: 'tab', description: '', children: { on: leaf } },
        box: { name: 'Box', as: 'panel', description: '', children: { on: leaf } },
      },
    },
  },
};

describe('PrefsForm empty description', () => {
  it('draws no description under a page, a section, a tab, or a panel whose description is empty', () => {
    const { container } = renderWithIcons(<PrefsForm schema={schema} values={{}} onChange={() => {}} layout="rail" />);
    expect(container.querySelectorAll(`.${s.paneDesc}`)).toHaveLength(0);
    expect([...container.querySelectorAll('[class*="note"]')].filter((el) => el.textContent === '')).toHaveLength(0);
  });
});
