import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';

afterEach(cleanup);
// React Aria opens a tooltip on hover only once the last interaction was a pointer one; a fresh tab has had none.
beforeAll(() => userEvent.click(document.body));

// A natively disabled button gets no pointer events, so whether its tooltip opens on hover is the browser's call.
test('hovering a disabled button opens its tooltip, which says why', async () => {
  render(<div style={{ margin: 40 }}><Button disabled disabledReason="Nothing has changed">Save</Button></div>);
  await userEvent.hover(screen.getByRole('button', { name: 'Save' }));
  const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
  expect(tip.textContent).toBe('Save: Nothing has changed');
});

test('hovering a disabled segment opens its tooltip', async () => {
  render(
    <div style={{ margin: 40 }}>
      <SegmentedBar
        aria-label="Align"
        value="l"
        onChange={() => {}}
        items={[
          { value: 'l', label: 'Left' },
          { value: 'r', label: 'Right', disabled: true, disabledReason: 'Needs a selection' },
        ]}
      />
    </div>,
  );
  await userEvent.hover(screen.getByRole('radio', { name: 'Right' }));
  const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
  expect(tip.textContent).toBe('Right: Needs a selection');
});
