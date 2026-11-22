/** The registry browser mounted on its own, outside the devtools panel, in a narrow host. */
import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { RegistryBrowser } from './RegistryBrowser';
import s from './RegistryBrowser.browser.module.css';

afterEach(cleanup);

test('stacks its list above its detail in a narrow host of its own', () => {
  const { container } = render(
    <div className={s.narrow}>
      <RegistryBrowser
        categories={[{ id: 'ops', label: 'Ops', entries: [{ id: 'rect', label: 'useRectTool' }] }]}
        selected={null}
        onSelectionChange={() => {}}
        detail={<p>detail</p>}
      />
    </div>,
  );
  const list = container.querySelector('[data-pane="list"]')!.getBoundingClientRect();
  const detail = container.querySelector('[data-pane="detail"]')!.getBoundingClientRect();
  expect(list.width).toBeCloseTo(300, 0);
  expect(detail.top).toBeGreaterThanOrEqual(list.bottom - 1);
});
