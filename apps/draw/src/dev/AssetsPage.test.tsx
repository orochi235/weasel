import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { AssetsPage } from './AssetsPage';
import { renderWithIcons } from '../testIcons';

afterEach(cleanup);

const tree = () => screen.getByRole('tree', { name: 'Schema structure' });
const asset = (label: string) =>
  within(screen.getByRole('listbox', { name: 'Assets' })).getByRole('option', { name: new RegExp(`^${label}(?!\\w)`) });

// The file's first pass through the page and a node's attributes costs as much again as every later one (JIT, jsdom's
// first stylesheet parse, Prism compiling its grammar), so it is paid here, on a clock of its own.
beforeAll(() => {
  renderWithIcons(<AssetsPage />);
  fireEvent.click(asset('Node: rect'));
  fireEvent.click(within(tree()).getByText('pose.x'));
  cleanup();
}, 30_000);

describe('AssetsPage', () => {
  it('opens on WeaselDraw preferences, and opens a node property schema picked from the list', () => {
    renderWithIcons(<AssetsPage />);
    expect(within(tree()).getByText('tools')).toBeInTheDocument();
    fireEvent.click(asset('Node: rect'));
    fireEvent.click(within(tree()).getByText('pose.x'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
    expect(within(screen.getByRole('region', { name: 'Live preview' })).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
  });

  it('describes registry-enum attributes, so its source is editable', () => {
    renderWithIcons(<AssetsPage />);
    fireEvent.click(within(tree()).getByText('lastTool'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
  });

  it('lists the surface assets and context menus, and opens one picked', () => {
    renderWithIcons(<AssetsPage />);
    for (const label of ['Arrange', 'Pathfinder', 'Path', 'Selection', 'Canvas', 'Layer row']) expect(asset(label)).toBeInTheDocument();
    fireEvent.click(asset('Arrange'));
    expect(within(tree()).getByText('reorder')).toBeInTheDocument();
  });

  it('lists the menu bar, and shows its titles in the structure tree', () => {
    renderWithIcons(<AssetsPage />);
    fireEvent.click(asset('Menu bar'));
    expect(within(tree()).getByText('File')).toBeInTheDocument();
  });
});
