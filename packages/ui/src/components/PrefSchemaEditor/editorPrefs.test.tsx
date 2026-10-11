import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import type { PrefSchemaEditorPrefs } from './editorPrefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

afterEach(cleanup);

const SCHEMA: PrefGroup = { name: 'Prefs', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } };

const dialog = () => within(screen.getByRole('dialog', { name: 'Schema editor preferences' }));
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));

describe('PrefSchemaEditor preferences', () => {
  it('opens its own settings from the bar, each at its default', () => {
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    open();
    expect(dialog().getByRole('checkbox', { name: 'Select what is dropped' })).toBeChecked();
    fireEvent.click(dialog().getByRole('checkbox', { name: 'Select what is dropped' }));
    expect(dialog().getByRole('checkbox', { name: 'Select what is dropped' })).not.toBeChecked();
  });

  it('reads and writes the host\'s store when it is given one', () => {
    const values = { preview: { selectDropped: false } };
    const set = vi.fn();
    const store = { subscribe: () => () => {}, values: () => values, set } as unknown as PrefSchemaEditorPrefs;
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} prefs={store} />);
    open();
    const box = dialog().getByRole('checkbox', { name: 'Select what is dropped' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(set).toHaveBeenCalledWith('preview.selectDropped', true);
  });

  it('opens each pane at the size the store holds, and writes a resize to it', () => {
    const values = { layout: { structureWidth: 420 } };
    const set = vi.fn();
    const store = { subscribe: () => () => {}, values: () => values, set } as unknown as PrefSchemaEditorPrefs;
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} prefs={store} unplaced={{ name: '', children: { snap: { kind: 'boolean', name: 'Snap', description: '', default: false } } }} />);
    const structure = screen.getByRole('separator', { name: 'Resize structure' });
    expect(structure).toHaveAttribute('aria-valuenow', '420');
    fireEvent.keyDown(structure, { key: 'ArrowRight' });
    expect(set).toHaveBeenCalledWith('layout.structureWidth', 421);
    expect(structure).toHaveAttribute('aria-valuenow', '421');
    // A store that holds no size leaves a pane at its default.
    const unplaced = screen.getByRole('separator', { name: 'Resize unplaced' });
    expect(unplaced).toHaveAttribute('aria-valuenow', '180');
    fireEvent.keyDown(unplaced, { key: 'ArrowUp' });
    expect(set).toHaveBeenCalledWith('layout.unplacedHeight', 181);
  });

  it('lists no pane size among its settings', () => {
    render(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />);
    open();
    expect(dialog().queryByText('Layout')).toBeNull();
    expect(dialog().queryByText('structureWidth')).toBeNull();
  });
});
