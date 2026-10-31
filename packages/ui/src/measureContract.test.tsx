import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UNBOUNDED, type MeasureEnv } from '@weasel-js/headless';
import { buttonFaceOf, domButton } from './components/Button';
import { domItemList, itemListFaceOf } from './components/ItemList';
import { nodeText } from './nodeText';

afterEach(cleanup);

const env: MeasureEnv = {
  token: (n) => ({ '--wzl-control-h': '28px', '--wzl-space-3': '6px', '--wzl-space-4': '8px', '--wzl-space-6': '12px', '--wzl-font-size': '12px', '--wzl-font-size-sm': '11px' } as Record<string, string>)[n],
  text: (t) => ({ width: t.length * 6, ascent: 10, descent: 2 }),
};

describe('nodeText', () => {
  it('reads the strings and numbers under a node, through elements', () => {
    expect(nodeText(<>Save <b>{3}</b> files</>)).toBe('Save 3 files');
    expect(nodeText(null)).toBe('');
  });
});

describe('domButton', () => {
  it('reads its children as the label, or as the icon when icon-only', () => {
    expect(buttonFaceOf({ children: <span>Go</span> })).toMatchObject({ label: 'Go', size: 'md' });
    expect(buttonFaceOf({ iconOnly: true, ariaLabel: 'Add', children: '+' })).toMatchObject({ iconOnly: true, icon: '+' });
    expect(buttonFaceOf({}).label).toBeUndefined();
  });

  it('measures through the shared measure and draws the button', () => {
    expect(domButton.measure({ children: 'Save' }, UNBOUNDED, env)).toMatchObject({ width: 48, height: 28 });
    render(domButton.draw({ children: 'Save' }, {}));
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('renders a slot for each part the shared measure lays out, in its order', () => {
    const props = { children: 'Go', leadingIcon: <i />, trailingIcon: <i /> };
    render(domButton.draw(props, {}));
    expect(screen.getByRole('button').children).toHaveLength(domButton.measure(props, UNBOUNDED, env).layout.parts.length);
  });
});

describe('domItemList', () => {
  const rows = [{ id: 'a', label: <em>Alpha</em>, leading: <i /> }, { id: 'b', label: 'Be' }];

  it('reads each label by its text, and its slots by the widths given', () => {
    expect(itemListFaceOf({ props: { rows }, slotWidth: () => 12 }).rows).toEqual([
      { id: 'a', label: 'Alpha', leadingWidth: 12, trailingWidth: undefined },
      { id: 'b', label: 'Be', leadingWidth: undefined, trailingWidth: undefined },
    ]);
  });

  it('measures rows a control height tall and draws the list', () => {
    expect(domItemList.measure({ props: { rows } }, UNBOUNDED, env).height).toBe(28 * 2 + 1);
    render(domItemList.draw({ props: { rows, selection: 'single' } }, {}));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
