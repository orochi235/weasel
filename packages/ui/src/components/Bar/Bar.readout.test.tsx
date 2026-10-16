import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

const schema: PrefGroup = {
  name: 'Status',
  children: {
    zoom: { ...pref.number('Zoom', 100), readout: true },
    snap: { ...pref.boolean('Snap', true, { control: 'toggle' }), readout: true },
    size: pref.number('Size', 12),
  },
};

describe('Bar readouts', () => {
  it('draws a readout leaf as its named value, beside editable neighbors', () => {
    render(<Bar schema={schema} values={{ zoom: 150, snap: true, size: 12 }} />);
    expect(screen.getByRole('status', { name: 'Zoom' }).textContent).toBe('150');
    expect(screen.getByRole('status', { name: 'Snap' }).textContent).toBe('On');
    expect(screen.queryByRole('button', { name: 'Snap' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDefined();
    expect(screen.getAllByText('Zoom', { selector: '[data-bar-label] *, [data-bar-label]' }).length).toBeGreaterThan(0);
  });
});
