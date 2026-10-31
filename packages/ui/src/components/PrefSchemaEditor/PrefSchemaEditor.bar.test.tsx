import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { ActionsProvider } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

const TOOLBAR: PrefGroup = {
  name: 'Text tools',
  as: 'bar',
  children: {
    size: { kind: 'number', name: 'Size', description: 'Type size.', default: 12 },
    bold: { kind: 'boolean', name: 'Bold', description: 'Heavier.', default: false },
    undo: { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' },
  },
};

function Live({ onSchema }: { onSchema?: (s: PrefGroup) => void }) {
  const [schema, setSchema] = useState(TOOLBAR);
  return (
    <ActionsProvider>
      <PrefSchemaEditor
        schema={schema}
        onChange={(next) => {
          setSchema(next);
          onSchema?.(next);
        }}
      />
    </ActionsProvider>
  );
}

const preview = () => screen.getByRole('region', { name: 'Live preview' });

describe('PrefSchemaEditor over a root drawn as a bar', () => {
  it('previews the toolbar itself, each pref in its bar form', () => {
    renderWithIcons(<Live />);
    const bar = within(preview()).getByRole('toolbar', { name: 'Text tools' });
    expect(within(bar).getByRole('spinbutton', { name: 'Size' })).toHaveValue('12');
    expect(within(bar).getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(bar).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(within(preview()).queryByRole('dialog')).toBeNull();
  });

  it('lists the bar’s prefs in the tree, since a bar holds them on no page', () => {
    renderWithIcons(<Live />);
    const tree = screen.getByRole('tree', { name: 'Schema structure' });
    expect(within(tree).getByText('size')).toBeInTheDocument();
    expect(within(tree).getByText('undo')).toBeInTheDocument();
  });

  it('runs the bar down its side from a switch', () => {
    renderWithIcons(<Live />);
    fireEvent.click(within(preview()).getByRole('switch', { name: 'Vertical' }));
    const bar = within(preview()).getByRole('toolbar', { name: 'Text tools' });
    expect(bar).toHaveAttribute('aria-orientation', 'vertical');
    // A field sits on it as on a bar that runs across, stacked.
    expect(within(bar).getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Size' })).toBeNull();
  });

  it('makes a value set in the preview that pref’s default', () => {
    let latest = TOOLBAR;
    renderWithIcons(<Live onSchema={(next) => { latest = next; }} />);
    fireEvent.click(within(preview()).getByRole('button', { name: 'Bold' }));
    expect((latest.children.bold as { default: unknown }).default).toBe(true);
  });
});
