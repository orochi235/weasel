/** An instrument's `renderTitle` reads the trial's config, and follows it as it changes. */
import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

const Lettered = defineInstrument({
  name: 'Lettered',
  title: 'beauty',
  config: f.schema({ letter: f.string('M').label('Letter') }),
  initialState: () => ({}),
  render: () => null,
  renderTitle: (title, { config }) => (
    <>
      <span data-testid="tag">{config.letter}</span> {title}
    </>
  ),
});

describe('renderTitle', () => {
  it('is handed the trial config, and redraws when it changes', async () => {
    await renderSettled(<Lab instruments={[Lettered]} />, {
      wrapper: withIcons,
    });
    expect(screen.getByTestId('tag')).toHaveTextContent('M');
    expect(document.querySelector('.lk-trial__title')).toHaveTextContent('M beauty');
    const field = screen.getByRole('textbox', { name: 'Letter' });
    fireEvent.change(field, { target: { value: 'W' } });
    fireEvent.blur(field);
    expect(screen.getByTestId('tag')).toHaveTextContent('W');
  });
});
