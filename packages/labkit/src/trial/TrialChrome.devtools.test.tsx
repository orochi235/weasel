import { screen } from '@testing-library/react';
import { useDevtoolsLabel } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

function Named() {
  return <output aria-label="devtools label">{useDevtoolsLabel()}</output>;
}

const instrument = defineInstrument<null, Record<string, never>>({
  name: 'Plain board',
  initialState: () => null,
  render: () => <Named />,
});

describe('a trial and devtools', () => {
  it("names the canvases in a trial by the trial's title, not by the pane they sit in", async () => {
    await renderSettled(<Lab instruments={[instrument]} />, {
      wrapper: withIcons,
    });
    expect(screen.getByLabelText('devtools label').textContent).toBe('Plain board');
  });
});
