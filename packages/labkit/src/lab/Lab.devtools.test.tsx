import { screen } from '@testing-library/react';
import { AmbientContributionsProvider, useProvidedAmbient } from '@weasel-js/core';
import { devtoolsOff, lazyDevtools } from '@weasel-js/devtools/mount';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';

/** What a canvas in the trial would take as its `devtools` entry. */
function Taken() {
  const entry = useProvidedAmbient().find((e) => e.id === 'devtools');
  const shown = entry === lazyDevtools ? 'on' : entry ? 'withheld' : 'none';
  return <output aria-label="devtools">{shown}</output>;
}

const instrument = defineInstrument<null, Record<string, never>>({
  name: 'Board',
  initialState: () => null,
  render: () => <Taken />,
});
const INSTRUMENTS = [instrument];
const OFF = [devtoolsOff];

const taken = () => screen.getByLabelText('devtools').textContent;

describe('<Lab> and devtools', () => {
  it("gives its trials' canvases devtools in a development build", async () => {
    await renderSettled(<Lab instruments={INSTRUMENTS} />, { wrapper: withIcons });
    expect(taken()).toBe('on');
  });

  it('withholds it given devtools={false}', async () => {
    await renderSettled(<Lab instruments={INSTRUMENTS} devtools={false} />, { wrapper: withIcons });
    expect(taken()).toBe('withheld');
  });

  it('withholds it under a provided devtoolsOff', async () => {
    await renderSettled(
      <AmbientContributionsProvider contributions={OFF}>
        <Lab instruments={INSTRUMENTS} />
      </AmbientContributionsProvider>,
      { wrapper: withIcons },
    );
    expect(taken()).toBe('withheld');
  });
});
