/** The front page in a window shorter than its column: a phone held sideways, a short desktop window. */
import '../canvas-kit-demo.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { FrontPage } from './FrontPage';

beforeAll(async () => { await page.viewport(640, 360); });
afterEach(() => {
  cleanup();
  document.getElementById('root')?.remove();
});

function mount() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  render(<FrontPage />, { container: root });
  return root.firstElementChild as HTMLElement;
}

test('a column taller than the window scrolls within the page, wordmark and last link both reachable', () => {
  const front = mount();
  expect(front.scrollHeight).toBeGreaterThan(front.clientHeight);
  expect(screen.getByRole('heading', { level: 1 }).getBoundingClientRect().top).toBeGreaterThanOrEqual(0);

  front.scrollTop = front.scrollHeight;
  expect(front.scrollTop).toBeGreaterThan(0);
  expect(screen.getAllByRole('link').at(-1)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(360);

  window.scrollTo(0, 5000);
  expect(window.scrollY).toBe(0);
});
