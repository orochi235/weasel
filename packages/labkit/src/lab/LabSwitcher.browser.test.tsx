import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LabShell } from './LabShell';

// The menu sits under the shell's title, so what it inherits from the title is
// cascade, which only a real browser computes.

afterEach(cleanup);

const PAGES = [
  { href: '/corpus', label: 'Wall' },
  { href: '/stats', label: 'Dashboard' },
];

test('only the open page is bold in the shell title menu', () => {
  render(
    <LabShell title="corpus" pages={PAGES} path="/corpus">
      <p>body</p>
    </LabShell>,
  );
  fireEvent.click(screen.getByRole('button', { name: /corpus/ }));
  const weight = (name: string) =>
    Number(getComputedStyle(screen.getByRole('menuitem', { name })).fontWeight);
  expect(weight('Wall')).toBeGreaterThan(weight('Dashboard'));
});
