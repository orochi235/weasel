import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDemo } from '../ExportDemo';

describe('ExportDemo', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:export');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists png and the svg format it registers', () => {
    render(<ExportDemo />);
    expect(screen.getByRole('radio', { name: 'PNG Image' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'SVG Document' })).toBeTruthy();
  });

  it('writes the page as SVG and offers it as a download', async () => {
    render(<ExportDemo />);
    fireEvent.click(screen.getByRole('radio', { name: 'SVG Document' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const link = await screen.findByRole('link', { name: /Download page\.svg/ }, { timeout: 10_000 });
    expect(link.getAttribute('download')).toBe('page.svg');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toContain('#a48bd4');
  });

  it('has no selection region until something is selected', () => {
    render(<ExportDemo />);
    fireEvent.click(screen.getByRole('radio', { name: 'Selection' }));
    expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true);
  });
});
