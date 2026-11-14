import { render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { PrefsForm } from '../Prefs/PrefsForm';
import { usePrefsSource } from './PrefsSource';

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
