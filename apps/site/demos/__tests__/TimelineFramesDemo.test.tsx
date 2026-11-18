import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const runs: AbortSignal[] = [];

vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@weasel-js/core')>(),
  rasterToPng: () => Promise.resolve(new Blob()),
  renderTimelineFrames: ({ signal }: { signal: AbortSignal }) => {
    runs.push(signal);
    return (async function* () {
      await new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      yield { index: 0, time: 0, image: {} };
    })();
  },
}));
vi.mock('@weasel-js/storage', () => ({ downloadBlob: vi.fn() }));

const { TimelineFramesDemo } = await import('../TimelineFramesDemo');

describe('TimelineFramesDemo', () => {
  it('starts no second save while one is running, and cancel stops the one running', async () => {
    runs.length = 0;
    render(<TimelineFramesDemo />);
    const save = screen.getByRole('button', { name: 'save frames' });
    act(() => { fireEvent.click(save); });
    act(() => { fireEvent.click(save); });
    expect(runs).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'cancel' })); });
    expect(runs[0]!.aborted).toBe(true);
    expect(await screen.findByText('canceled')).toBeTruthy();
  });

  it('aborts a running save when the demo unmounts', () => {
    runs.length = 0;
    const { unmount } = render(<TimelineFramesDemo />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'save frames' })); });
    expect(runs).toHaveLength(1);
    unmount();
    expect(runs[0]!.aborted).toBe(true);
  });
});
