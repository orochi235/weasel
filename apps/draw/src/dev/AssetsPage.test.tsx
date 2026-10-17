import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AssetsPage } from './AssetsPage';

afterEach(cleanup);

const tree = () => screen.getByRole('tree', { name: 'Schema structure' });
const asset = (label: string) =>
  within(screen.getByRole('listbox', { name: 'Assets' })).getByRole('option', { name: new RegExp(`^${label}(?!\\w)`) });

describe('AssetsPage', () => {
  it('opens on WeaselDraw preferences, and opens a node property schema picked from the list', () => {
    render(<AssetsPage />);
    expect(within(tree()).getByText('tools')).toBeInTheDocument();
    fireEvent.click(asset('Node: rect'));
    fireEvent.click(within(tree()).getByText('pose.x'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
    expect(within(screen.getByRole('region', { name: 'Live preview' })).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
  });

  it('describes registry-enum attributes, so its source is editable', () => {
    render(<AssetsPage />);
    fireEvent.click(within(tree()).getByText('lastTool'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
  });

  it('lists the surface assets and context menus, and opens one picked', () => {
    render(<AssetsPage />);
    for (const label of ['Arrange', 'Pathfinder', 'Path', 'Selection', 'Canvas', 'Layer row']) expect(asset(label)).toBeInTheDocument();
    fireEvent.click(asset('Arrange'));
    expect(within(tree()).getByText('reorder')).toBeInTheDocument();
  });
});
