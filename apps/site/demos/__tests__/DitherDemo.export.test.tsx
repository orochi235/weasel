import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const exportPage = vi.hoisted(() => vi.fn());
vi.mock('../ditherDemoExport', async (actual) => ({ ...(await actual<object>()), exportPage }));

const { DitherDemo } = await import('../DitherDemo');

afterEach(cleanup);

describe('DitherDemo export pane', () => {
  it('clears the last export when the next one fails, so the caption never describes a stale picture', async () => {
    exportPage.mockResolvedValue({ width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4) });
    const { getByRole, getByLabelText } = render(<DitherDemo />);
    await act(async () => {});
    const out = getByLabelText('Exported page') as HTMLCanvasElement;
    expect([out.width, out.height]).toEqual([4, 2]);

    exportPage.mockRejectedValue(new Error('no'));
    await act(async () => { fireEvent.click(getByRole('radio', { name: 'Atkinson' })); });
    expect([out.width, out.height]).toEqual([0, 0]);
  });
});
