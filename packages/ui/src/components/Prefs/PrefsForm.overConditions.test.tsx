import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PrefBooleanEncoding, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const italic: PrefBooleanEncoding = { read: (stored) => stored === 'italic', write: (on) => (on ? 'italic' : 'normal') };

// The schema the settings live in, which the form is not drawn from.
const dialog: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On', { default: true }),
    slant: flag('Italic', { default: 'normal', encoding: italic }),
    both: flag('Both', { default: true }),
  },
};
// A panel whose own nodes are conditioned on that schema's settings.
const panel: PrefGroup = {
  name: 'Panel',
  children: {
    both: flag('Both here'),
    rows: {
      name: 'Rows',
      children: {
        byDefault: flag('By default', { showIf: { path: 'on' } }),
        bySlant: flag('By slant', { enableIf: { path: 'slant' } }),
        byOwn: flag('By own', { showIf: { path: 'both' } }),
        tags: {
          kind: 'list', name: 'Stops', description: '', default: [1],
          item: { kind: 'number', name: 'Stop', description: '', default: 0, enableIf: { all: [{ path: '', from: 'item', is: 1 }, { path: 'on' }] } },
        } as PrefLeaf,
      },
    },
  },
};

const box = (name: string) => screen.queryByRole('checkbox', { name });

describe('a condition of a form\'s own node that reads a pref of `over`', () => {
  it('reads that pref\'s default where the values hold nothing', () => {
    const alone = render(<PrefsForm schema={panel} values={{}} onChange={() => {}} />);
    expect(box('By default')).toBeNull();
    alone.unmount();
    render(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(box('By default')).toBeInTheDocument();
  });

  it('reads the value the form holds at that pref\'s path', () => {
    render(<PrefsForm schema={panel} values={{ on: false }} over={dialog} onChange={() => {}} />);
    expect(box('By default')).toBeNull();
  });

  it('compares the value as that pref\'s control shows it', () => {
    const { rerender } = render(<PrefsForm schema={panel} values={{ slant: 'normal' }} over={dialog} onChange={() => {}} />);
    expect(box('By slant')).toBeDisabled();
    rerender(<PrefsForm schema={panel} values={{ slant: 'italic' }} over={dialog} onChange={() => {}} />);
    expect(box('By slant')).toBeEnabled();
  });

  it('reads the form\'s own leaf at a path both schemas hold', () => {
    render(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(box('By own')).toBeNull();
  });

  it('answers a condition that reads an entry of a list the same way', () => {
    const { rerender } = render(<PrefsForm schema={panel} values={{}} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toBeEnabled();
    rerender(<PrefsForm schema={panel} values={{ on: false }} over={dialog} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
