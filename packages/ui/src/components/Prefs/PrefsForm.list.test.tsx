import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';
import type { PrefGroup } from '@weasel-js/prefs';

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Root',
  children: {
    loose: { kind: 'boolean', name: 'Loose', description: '', default: false },
    nested: { name: 'Nested', children: {
      inner: { kind: 'boolean', name: 'Inner', description: '', default: false },
    } },
    bare: { name: '', children: {
      quiet: { kind: 'boolean', name: 'Quiet', description: '', default: false },
    } },
  },
};

describe('<PrefsForm layout="list">', () => {
  it('sets the root\'s leaves down one column with no panel heading over them, and its groups as sub-panels', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} layout="list" />);
    expect(screen.getByRole('checkbox', { name: 'Loose' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Root' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Nested' })).toBeInTheDocument();
  });
});

describe('a group named with the empty string', () => {
  it('draws no heading, as the schema promises', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} layout="list" />);
    expect(screen.getByRole('checkbox', { name: 'Quiet' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Nested']);
  });
});
