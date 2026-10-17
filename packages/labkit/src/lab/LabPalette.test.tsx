import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { icon } from '../icons.gen';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const Glyph = icon('ui:add');
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};
const tools = [
  { id: 'pick', label: 'Pick', icon: Glyph },
  { id: 'pan', label: 'Pan', icon: Glyph },
];

describe('the lab palette', () => {
  it('does not render when the lab declares no tools', async () => {
    await renderSettled(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" />, {
      wrapper: withIcons,
    });
    expect(screen.queryByRole('toolbar', { name: 'Tools' })).toBeNull();
  });

  it('renders one button per declared tool', async () => {
    await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" tools={tools} />,
      { wrapper: withIcons },
    );
    expect(screen.getByRole('button', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
  });

  it('marks the chosen tool current after a click', async () => {
    await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" tools={tools} />,
      { wrapper: withIcons },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pan' }));
    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-current', 'true');
  });
});
