import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import '../lab/presentation.browser.test.less';
import { cleanup } from '@testing-library/react';
import { defineInstrument, f, Lab } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

// Whether the panel takes no width from the body, and lies over it, is layout: only a browser can say.

afterEach(cleanup);

const Gridded = defineInstrument({
  name: 'Gridded',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  render: () => <div data-testid="output" />,
});

test('a floating sidebar leaves the body its whole box, open or closed, and floats over it', async () => {
  const { container, getByRole, queryByRole } = renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[Gridded]} defaultInstrument="Gridded" sidebar="float" />
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
  expect(panel.right).toBeLessThanOrEqual(open.right + 1);
  expect(panel.left).toBeGreaterThanOrEqual(open.left);

  await userEvent.keyboard('{Escape}');
  await expect.poll(() => queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(toggle);
});
