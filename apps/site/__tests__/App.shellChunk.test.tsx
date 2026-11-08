import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../App';

vi.mock('../Shell', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/Shell-old.js');
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

it('keeps a shell that fails to load inside a boundary, rather than unmounting the site', async () => {
  window.location.hash = '#__get_started';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload');
});
