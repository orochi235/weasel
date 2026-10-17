import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const structure = () => screen.getByRole('tree', { name: 'Schema structure' });

describe('PrefSchemaEditor: a pref that holds no value', () => {
  it('gets no Default row, read-only or otherwise', () => {
    const start: PrefSection = { name: 'Rect', members: {
      note: { kind: 'label', name: 'Note', description: 'Text among the rows.', default: undefined } as PrefLeaf,
      rule: { kind: 'separator', name: '', description: '', default: undefined } as PrefLeaf,
      x: { kind: 'number', name: 'X', description: '', default: 0 },
    } };
    renderWithIcons(<PrefSchemaEditor schema={start} onChange={() => {}} />);
    const pane = screen.getByRole('region', { name: 'Attributes' });
    fireEvent.click(within(structure()).getByText('x'));
    expect(pane).toHaveTextContent('Default');
    fireEvent.click(within(structure()).getByText('note'));
    expect(pane).not.toHaveTextContent(/default/i);
    expect(pane).not.toHaveTextContent('undefined');
    fireEvent.click(within(structure()).getByText('rule'));
    expect(pane).not.toHaveTextContent(/default/i);
  });
});
