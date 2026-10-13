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

  const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
    ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
  const stroked = (hidden: boolean): PrefGroup => ({
    name: 'Root',
    children: {
      stroke: {
        kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0, cap: 0 }, hidden,
        children: {
          width: num('Width'),
          dash: num('Dash', { showIf: { path: 'stroke.width', above: 0 } }),
          cap: num('Cap', { enableIf: { path: 'stroke.width', above: 0 } }),
        },
      } as PrefLeaf,
      quick: { name: 'Quick', children: { stroke: { kind: 'alias', name: 'Quick stroke', description: '', default: undefined, of: 'stroke' } as PrefLeaf } },
    },
  });

  it('draws no field of an object leaf that a showIf hides in the leaf\'s own row', () => {
    const { rerender } = render(<PrefsForm schema={stroked(false)} values={{}} onChange={noop} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Width' })).toHaveLength(2);
    expect(screen.queryByRole('spinbutton', { name: 'Dash' })).toBeNull();
    rerender(<PrefsForm schema={stroked(false)} values={{ stroke: { width: 2, dash: 0, cap: 0 } }} onChange={noop} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Dash' })).toHaveLength(2);
  });

  it('hides and disables the fields of an object leaf the form itself leaves out', () => {
    render(<PrefsForm schema={stroked(true)} values={{}} onChange={noop} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Width' })).toHaveLength(1);
    expect(screen.queryByRole('spinbutton', { name: 'Dash' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeDisabled();
  });

  it('leaves out a field of an object leaf marked hidden, as the leaf\'s own row does, until hidden ones are shown', () => {
    const schema: PrefGroup = {
      name: 'Root',
      children: {
        stroke: {
          kind: 'object', name: 'Stroke', description: '', default: { width: 0, miter: 0 }, hidden: true,
          children: { width: num('Width'), miter: num('Miter', { hidden: true }) },
        } as PrefLeaf,
        quick: { name: 'Quick', children: { stroke: { kind: 'alias', name: 'Quick stroke', description: '', default: undefined, of: 'stroke' } as PrefLeaf } },
      },
    };
    const { rerender } = render(<PrefsForm schema={schema} values={{}} onChange={noop} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Width' })).toHaveLength(1);
    expect(screen.queryByRole('spinbutton', { name: 'Miter' })).toBeNull();
    rerender(<PrefsForm schema={schema} values={{}} showHidden onChange={noop} />);
    expect(screen.getAllByRole('spinbutton', { name: 'Miter' })).toHaveLength(2);
  });

  it('marks the field hidden where the form draws what a showIf hides', () => {
    render(<PrefsForm schema={stroked(true)} values={{}} markHidden onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Dash' }).closest('[data-pref-hidden]')).not.toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Width' }).closest('[data-pref-hidden]')).toBeNull();
  });
});
