import { fireEvent, screen } from '@testing-library/react';
import { openPrefsSync, type PrefGroup } from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { PrefsForm } from './PrefsForm';

const SCHEMA = {
  name: 'Settings',
  children: {
    view: {
      name: 'View',
      resettable: true,
      children: {
        size: { kind: 'number', name: 'Size', description: '', default: 10, min: 0, max: 100, auto: { value: 40 } },
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, auto: { on: true } },
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true, auto: false, control: 'switch' },
      },
    },
  },
} satisfies PrefGroup;

function StoreBound() {
  const [store] = useState(() => openPrefsSync(SCHEMA, { storage: createMemoryAdapter(new Map()), prefix: 't.' }));
  const { form } = usePrefsValues(store);
  return <PrefsForm {...form} layout="list" />;
}

/** A form over plain values, with no auto state and no `onReset`: it resets through `onChange`. */
function Plain() {
  const [values, setValues] = useState<Record<string, unknown>>({ view: { size: 10, gap: 4, grid: true } });
  return (
    <PrefsForm schema={SCHEMA} layout="list" values={values}
      onChange={(path, value) => setValues((v) => ({ view: { ...(v.view as object), [path.split('.')[1]!]: value } }))} />
  );
}

const pinned = (name: string) => screen.getByRole('button', { name: `Pin ${name}` }).getAttribute('aria-pressed') === 'true';
const reset = (name: string) => screen.queryByRole('button', { name: `Reset ${name}` });

describe('PrefsForm resets, bound to a store', () => {
  it('offers a row reset only while the leaf differs from what a reset makes it', () => {
    renderWithIcons(<StoreBound />);
    expect(pinned('Gap')).toBe(false);
    expect(reset('Size')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pin Size' }));
    expect(pinned('Size')).toBe(false);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue('40');
    fireEvent.click(reset('Size')!);
    expect(pinned('Size')).toBe(true);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue('10');
  });

  it('puts a leaf that starts auto back to auto, and a group back whole', () => {
    renderWithIcons(<StoreBound />);
    expect(reset('View')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(pinned('Gap')).toBe(true);
    fireEvent.click(reset('Gap')!);
    expect(pinned('Gap')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Grid' }));
    fireEvent.click(reset('View')!);
    expect(pinned('Gap')).toBe(false);
    expect(screen.getByRole('switch', { name: 'Grid' })).toBeChecked();
    expect(reset('View')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('PrefsForm resets over plain values', () => {
  it('writes what a leaf reads after a reset through `onChange`', () => {
    renderWithIcons(<Plain />);
    fireEvent.click(screen.getByRole('switch', { name: 'Grid' }));
    expect(reset('Grid')).not.toBeNull();
    fireEvent.click(reset('Grid')!);
    expect(screen.getByRole('switch', { name: 'Grid' })).toBeChecked();
    expect(reset('Grid')).toBeNull();
  });
});
