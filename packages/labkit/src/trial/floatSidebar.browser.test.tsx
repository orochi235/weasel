import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import '../lab/presentation.browser.test.less';
import { cleanup } from '@testing-library/react';
import { defineInstrument, f, Lab } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

// Whether the panel takes no width from the body, and lies over it, is layout: only a browser can say.

afterEach(cleanup);

const Gridded = defineInstrument({
  name: 'Gridded',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  render: () => <div data-testid="output" />,
});

test('a floating sidebar leaves the body its whole box, open or closed, and floats over it centered on its toggle', async () => {
  // Wider than the frame, or the toggle sits past vitest's default viewport and the panel is shifted back onto it.
  await page.viewport(1024, 768);
  const { container, getByRole, queryByRole } = renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[Gridded]} sidebar="float" />
    </div>,
  );
  const box = (selector: string) =>
    (container.querySelector(selector) as Element).getBoundingClientRect();
  await expect.poll(() => box('.lk-trial__body').width).toBeGreaterThan(0);
  const closed = box('.lk-trial__content');
  expect(closed.width).toBe(box('.lk-trial__body').width);

  const toggle = getByRole('button', { name: 'Trial settings' });
  await userEvent.click(toggle);
  const dialog = getByRole('dialog', { name: 'Gridded settings' });
  await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);
  const open = box('.lk-trial__content');
  expect(open).toEqual(closed);
  const panel = dialog.getBoundingClientRect();
  expect(panel.top).toBeGreaterThanOrEqual(box('.lk-trial__titlebar').bottom - 1);
  const button = toggle.getBoundingClientRect();
  // Centered under the press, not hung from one end of the button.
  expect(Math.abs(panel.left + panel.width / 2 - (button.left + button.width / 2))).toBeLessThan(1);

  await userEvent.keyboard('{Escape}');
  await expect.poll(() => queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(toggle);
});
