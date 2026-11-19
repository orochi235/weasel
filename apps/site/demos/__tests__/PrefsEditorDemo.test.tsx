import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithIcons } from '../../testIcons';
import { PrefsEditorDemo } from '../PrefsEditorDemo';

afterEach(cleanup);

describe('PrefsEditorDemo', () => {
  it('hands each edit back as a new schema, which the leaf list reads', () => {
    renderWithIcons(<PrefsEditorDemo />);
    const leaves = screen.getByRole('list', { name: 'Leaves in the schema' });
    expect(leaves.textContent).toContain('“Grid gap”');
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('gap'));
    const name = within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Spacing' } });
    fireEvent.blur(name);
    expect(leaves.textContent).toContain('“Spacing”');
  });
});
