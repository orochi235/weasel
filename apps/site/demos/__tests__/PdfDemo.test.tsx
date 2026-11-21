import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const exportRegionsPdf = vi.fn();
vi.mock('@weasel-js/pdf/export', () => ({ exportRegionsPdf: (...a: unknown[]) => exportRegionsPdf(...a) }));

const { PdfDemo } = await import('../PdfDemo');

describe('PdfDemo', () => {
  it('withdraws the previous download when a later write fails', async () => {
    render(<PdfDemo />);
    exportRegionsPdf.mockResolvedValueOnce(new Blob(['%PDF']));
    await act(async () => { fireEvent.click(screen.getByText('Write PDF')); });
    expect(screen.getByText(/shapes\.pdf/)).toBeTruthy();
    exportRegionsPdf.mockRejectedValueOnce(new Error('no fonts'));
    await act(async () => { fireEvent.click(screen.getByText('Write PDF')); });
    expect(screen.getByRole('alert').textContent).toContain('no fonts');
    expect(screen.queryByText(/shapes\.pdf/)).toBeNull();
  });
});
