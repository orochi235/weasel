import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PrefSchemaPage } from './PrefSchemaPage';

afterEach(cleanup);

describe('PrefSchemaPage', () => {
  it('opens on WeaselDraw preferences, and opens a node property schema picked as the source', () => {
    render(<PrefSchemaPage />);
    const tree = () => screen.getByRole('tree', { name: 'Schema structure' });
    expect(within(tree()).getByText('(tools)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Source/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Node: rect' }));
    fireEvent.click(within(tree()).getByText('(pose.x)'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Key' })).toHaveValue('pose.x');
    expect(within(screen.getByRole('region', { name: 'Live preview' })).getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
  });

  it('describes registry-enum attributes, so its source is editable', () => {
    render(<PrefSchemaPage />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('(lastTool)'));
    expect(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
  });
});
