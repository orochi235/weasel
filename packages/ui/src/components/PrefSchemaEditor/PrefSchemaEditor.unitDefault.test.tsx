import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

// Stored as a fraction, shown as a percent.
const START: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      dim: {
        kind: 'number', name: 'Dim', description: '', default: 0.5, min: 0, max: 1, auto: { value: 0.25 },
        unit: { scale: 0.01, suffix: '%' },
      },
    } },
  },
};

let latest: PrefGroup = START;
function Live() {
  const [schema, setSchema] = useState(START);
  latest = schema;
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}

const attributes = () => within(screen.getByRole('region', { name: 'Attributes' }));
const dim = () => (latest.children.view as PrefGroup).children.dim as unknown as Record<string, unknown>;
const type = (name: string, text: string) => {
  const input = attributes().getByRole('spinbutton', { name });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
};

describe('PrefSchemaEditor: a number shown in a unit', () => {
  it('shows its default and its auto value in that unit', () => {
    renderWithIcons(<Live />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('dim'));
    expect(attributes().getByRole('spinbutton', { name: 'Default' })).toHaveValue('50');
    expect(attributes().getByRole('spinbutton', { name: 'Auto value' })).toHaveValue('25');
  });

  it('stores what is typed there in the stored unit', () => {
    renderWithIcons(<Live />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('dim'));
    type('Default', '80');
    expect(dim().default).toBeCloseTo(0.8);
    type('Auto value', '10');
    expect((dim().auto as { value: number }).value).toBeCloseTo(0.1);
  });
});
