import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageDemo } from '../StorageDemo';

const clear = () => {
  for (const key of Object.keys(localStorage)) if (key.startsWith('weasel-demo-storage.')) localStorage.removeItem(key);
};

beforeEach(clear);
afterEach(() => {
  cleanup();
  clear();
});

describe('StorageDemo', () => {
  it('keeps its count in localStorage, so a second mount opens holding it', async () => {
    const first = render(<StorageDemo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }));
    expect(screen.getByRole('row', { name: /^count/ }).textContent).toMatch(/^count2/);
    // Unmounting closes the cache, which sends its queued write.
    await act(async () => {
      first.unmount();
      await Promise.resolve();
    });
    expect(localStorage.getItem('weasel-demo-storage.count')).toBe('2');
    render(<StorageDemo />);
    expect((await screen.findByRole('row', { name: /^count/ })).textContent).toMatch(/^count22/);
  });
});
