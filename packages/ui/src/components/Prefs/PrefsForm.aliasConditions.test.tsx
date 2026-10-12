import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const noop = (): void => {};

const schema: PrefGroup = {
  name: 'Root',
  children: {
    on: flag('On'),
    open: flag('Open'),
    view: {
      name: 'View',
      showIf: { path: 'on' },
      children: { grid: flag('Show grid', { hidden: true, enableIf: { path: 'open' } }) },
    },
    quick: { name: 'Quick', children: { grid: { kind: 'alias', name: 'Quick grid', description: '', default: undefined, of: 'view.grid' } as PrefLeaf } },
  },
};

describe('an alias row in PrefsForm', () => {
  it('is disabled while the leaf it shows is, one the form itself leaves out among them', () => {
    const { rerender } = render(<PrefsForm schema={schema} values={{ on: true, open: false }} onChange={noop} />);
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).toBeNull();
    const box = screen.getByRole('checkbox', { name: 'Quick grid' });
    expect(box).toBeDisabled();
    expect(box.closest('[data-property-row][data-disabled]')).not.toBeNull();
    rerender(<PrefsForm schema={schema} values={{ on: true, open: true }} onChange={noop} />);
    expect(screen.getByRole('checkbox', { name: 'Quick grid' })).toBeEnabled();
  });

  it('is not drawn while a group above the leaf it shows is not', () => {
    render(<PrefsForm schema={schema} values={{ on: false, open: true }} onChange={noop} />);
    expect(screen.queryByRole('checkbox', { name: 'Quick grid' })).toBeNull();
    expect(screen.queryByText('Quick grid')).toBeNull();
  });
});
