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
  fireEvent.click(asset('rect'));
  fireEvent.click(within(tree()).getByText('pose.x'));
  cleanup();
}, 30_000);

describe('AssetsPage', () => {
  it('opens on WeaselDraw preferences, and opens a node property schema picked from the list', () => {
    renderWithIcons(<AssetsPage />);
    expect(within(tree()).getByText('tools')).toBeInTheDocument();
    fireEvent.click(asset('rect'));
    fireEvent.click(within(tree()).getByText('pose.x'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
    expect(within(screen.getByRole('region', { name: 'Live preview' })).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
    // About 0.5 s of jsdom work alone, spread over every pane; a loaded fleet node runs it seven to ten times slower.
  }, 15_000);

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

  it.each([['Colors', 'Colors'], ['Properties', 'Selection'], ['Simplify and Offset', 'Simplify']])(
    'previews %s with a note where the app draws a leaf itself',
    (label, leaf) => {
      renderWithIcons(<AssetsPage />);
      fireEvent.click(asset(label));
      const preview = within(screen.getByRole('region', { name: 'Live preview' }));
      expect(preview.getByText(`${leaf}: drawn by WeaselDraw`)).toBeInTheDocument();
      expect(preview.queryByText(/no renderer/)).toBeNull();
    },
  );

  it("lists the feature bundles, with core's and path-tools' presets in their packages' sections", () => {
    renderWithIcons(<AssetsPage />);
    fireEvent.click(asset('Feature bundles'));
    expect(within(tree()).getByText('@weasel-js/core')).toBeInTheDocument();
    expect(within(tree()).getByText('@weasel-js/path-tools')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'JSON' })).toBeInTheDocument();
  });

  it('lists the menu bar, and shows its titles in the structure tree', () => {
    renderWithIcons(<AssetsPage />);
    fireEvent.click(asset('Menu bar'));
    expect(within(tree()).getByText('File')).toBeInTheDocument();
  });
});
