import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { BarMenu } from './BarMenu';
import s from './BarMenu.browser.test.module.css';

afterEach(cleanup);

const A: Action = { id: 'a', label: 'A', invoker: { timing: 'immediate', run: () => {} } };
const FILE: PrefGroup = {
  name: 'File', description: '', as: 'menu',
  children: { a: { kind: 'action', name: '', description: '', default: undefined, action: 'a' } },
};

function Setup() {
  useAction(A);
  return (
    <div className={s.bottom}>
      <BarMenu label="File" schema={FILE} values={() => undefined} />
    </div>
  );
}

it('opens above a button at the bottom of the viewport', async () => {
  await page.viewport(800, 600);
  render(<ActionsProvider><Setup /></ActionsProvider>);
  const trigger = screen.getByRole('button', { name: 'File' });
  await userEvent.click(trigger);
  const button = trigger.getBoundingClientRect();
  const menu = screen.getByRole('menu').getBoundingClientRect();
  expect(menu.bottom).toBeLessThanOrEqual(button.top);
  expect(menu.left).toBe(button.left);
});
