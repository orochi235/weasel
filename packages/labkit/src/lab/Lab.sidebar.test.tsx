import { screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <p data-testid="output">out</p>,
};

const notes: TrialContribution = {
  id: 'notes',
  region: 'sidebar',
  item: { title: 'Notes', body: <p>jot</p> },
};

describe("a trial's sidebar", () => {
  it('takes no room when nothing contributes a section', async () => {
    const { container } = await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" />,
      { wrapper: withIcons },
    );
    expect(container.querySelector('.lk-trial__sidebar')).toBeNull();
    expect(screen.queryByRole('separator', { name: /sidebar/i })).toBeNull();
    expect(container.querySelector('.lk-trial__content')).toContainElement(
      screen.getByTestId('output'),
    );
  });

  it('is there once a section is contributed', async () => {
    const { container } = await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[notes]} />,
      { wrapper: withIcons },
    );
    expect(container.querySelector('.lk-trial__sidebar')).not.toBeNull();
  });
});
