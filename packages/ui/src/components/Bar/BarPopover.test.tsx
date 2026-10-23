import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useContext } from 'react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { BarPopover } from './BarPopover';
import { BarSideContext } from './barSide';

afterEach(cleanup);

function Side() {
  return <output aria-label="side">{useContext(BarSideContext) ?? 'none'}</output>;
}

it("hands its body no side, so a popover nested in it opens as a straight bar's would", async () => {
  await renderSettled(
    <BarSideContext.Provider value="left">
      <BarPopover label="Outer"><Side /></BarPopover>
    </BarSideContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Outer' }));
  expect(screen.getByRole('status', { name: 'side' }).textContent).toBe('none');
});
