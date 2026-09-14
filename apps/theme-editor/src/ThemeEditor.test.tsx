import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEditor } from './ThemeEditor';
import type { ThemeApi } from './theme/api';

describe('<ThemeEditor>', () => {
  afterEach(cleanup);

  it('falls back to the built themes, read-only, when no dev server answers', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    render(<ThemeEditor api={failing} />);
    expect(await screen.findByText('23 of 100 overridden')).toBeInTheDocument();
    expect(failing.put).not.toHaveBeenCalled();
  });
});
