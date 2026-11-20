import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './Workspace.floating.browser.test.less';
import { cleanup } from '@testing-library/react';
import { Workspace } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';

// Where floating panels sit is layout: a browser's to answer.

afterEach(cleanup);

test('floating panels stack rather than cover one another, inside the workspace', () => {
  const { container } = renderWithIcons(
    <div className="lk-floating-frame">
      <Workspace
        viewport={{ w: 640, h: 480 }}
        panels={[
          { key: 'a', title: 'A', as: 'floating' },
          { key: 'b', title: 'B', as: 'floating' },
        ]}
      >
        <div>trial</div>
      </Workspace>
    </div>,
  );
  const [a, b] = [...container.querySelectorAll('.lk-panel-tile--floating')].map((el) =>
    el.getBoundingClientRect(),
  );
  const host = container.querySelector('.lk-workspace-host')?.getBoundingClientRect();
  expect(a && b && host).toBeTruthy();
  if (!a || !b || !host) return;
  expect(b.top).toBeGreaterThanOrEqual(a.bottom);
  expect(b.bottom).toBeLessThanOrEqual(host.bottom + 1);
  expect(Math.max(a.right, b.right)).toBeLessThanOrEqual(host.right + 1);
});
