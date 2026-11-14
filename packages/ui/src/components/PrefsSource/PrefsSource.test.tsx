import { render, screen } from '@testing-library/react';
import { AUTO, type PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { PrefsForm } from '../Prefs/PrefsForm';
import { usePrefsSource } from './PrefsSource';
import { valuesSource } from './useValuesSource';

const SCHEMA = {
  name: 'Settings',
  children: {
    view: {
      name: 'View',
      resettable: true,
      children: {
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true } },
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true },
        note: { kind: 'note', name: 'Note', description: '', default: '' },
      },
    },
  },
} as unknown as PrefGroup;

describe('valuesSource', () => {
  it('reads a leaf as shown, with its auto state only where the owner keeps one', () => {
    const kept = valuesSource(SCHEMA, { view: { gap: 9 } }, () => {}, { auto: new Set(['view.gap']), onAutoChange: () => {} });
    expect(kept.valueAt('view.gap')).toEqual({ value: 9, mixed: false, each: [9], auto: true });
    expect(kept.valueAt('view.grid')).toEqual({ value: true, mixed: false, each: [true] });
    const plain = valuesSource(SCHEMA, { view: { gap: 9 } }, () => {});
    expect(plain.autoAt('view.gap')).toBeUndefined();
  });

  it('resets a group leaf by leaf: unpinning through onAutoChange, pinning through onChange', () => {
    const onChange = vi.fn();
    const onAutoChange = vi.fn();
    const source = valuesSource(SCHEMA, { view: { gap: 9, grid: false } }, onChange, { auto: new Set(), onAutoChange });
    source.reset(['view']);
    expect(onAutoChange.mock.calls).toEqual([['view.gap', true]]);
    expect(onChange.mock.calls).toEqual([['view.grid', true]]);
    source.write('view.gap', AUTO);
    expect(onAutoChange).toHaveBeenLastCalledWith('view.gap', true);
  });
});

describe('<PrefsForm> hands its leaves its source', () => {
  it('lets a renderer read another leaf through the source', () => {
    function Note() {
      const source = usePrefsSource();
      return <span>grid is {String(source.valueAt('view.grid').value)}</span>;
    }
    render(
      <PrefsForm schema={SCHEMA} values={{ view: { grid: false } }} onChange={() => {}} layout="list"
        renderers={{ note: () => <Note /> }} />,
    );
    expect(screen.getByText('grid is false')).toBeInTheDocument();
  });
});
