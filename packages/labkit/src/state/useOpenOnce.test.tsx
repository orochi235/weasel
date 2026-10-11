import { render, screen, waitFor } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useOpenOnce } from './useOpenOnce';

class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  override state = { message: null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  override render() {
    return this.state.message === null ? this.props.children : <p>failed: {this.state.message}</p>;
  }
}

function Opens({ open }: { open: () => Promise<{ close(): void }> }) {
  const opened = useOpenOnce(open);
  return <p>{opened ? 'open' : 'waiting'}</p>;
}

describe('useOpenOnce', () => {
  it('throws a rejected open in render, where an error boundary catches it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Boundary>
        <Opens open={() => Promise.reject(new Error('no such instrument'))} />
      </Boundary>,
    );
    expect(screen.getByText('waiting')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('failed: no such instrument')).toBeInTheDocument());
    error.mockRestore();
  });
});
