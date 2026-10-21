/**
 * The demo page's devtools split at 1440×900, the page's own proportions: the
 * site's sidebar leaves the main pane about 1160 px, a demo is up to 1100 px
 * wide, and the switch sits under a header a few hundred pixels tall.
 */
import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { DevtoolsSplit } from './DevtoolsSplit';
import s from './DevtoolsSplit.browser.module.css';

beforeAll(async () => { await page.viewport(1440, 900); });
afterEach(cleanup);

function mount(open: boolean) {
  const { container, rerender } = render(
    <div className={s.main}>
      <article className={s.article}>
        <div className={s.header}>header</div>
        <DevtoolsSplit panel={open ? <div className={s.panel} data-testid="panel" /> : null}>
          <div className={s.demo} data-testid="demo" />
        </DevtoolsSplit>
      </article>
    </div>,
  );
  return { container, rerender };
}

test('switched on, the panel sits beside the demo and wholly in view', () => {
  const { container } = mount(true);
  const panel = container.querySelector('[data-testid="panel"]')!.getBoundingClientRect();
  const demoColumn = container.querySelector('[data-testid="demo"]')!.parentElement!.getBoundingClientRect();
  expect(panel.width).toBeGreaterThanOrEqual(360);
  expect(panel.top).toBeGreaterThanOrEqual(0);
  expect(panel.bottom).toBeLessThanOrEqual(900);
  expect(panel.left).toBeGreaterThanOrEqual(demoColumn.right);
  expect(panel.right).toBeLessThanOrEqual(1440);
  expect(demoColumn.width).toBeLessThan(1100);
});

test('switched off, the demo has its whole width back', () => {
  const { container } = mount(false);
  const demoColumn = container.querySelector('[data-testid="demo"]')!.parentElement!.getBoundingClientRect();
  expect(demoColumn.width).toBeGreaterThanOrEqual(1100);
});
