import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { PdfDemo } from '../PdfDemo';

describe('PdfDemo', () => {
  beforeEach(() => {
    // jsdom's Blob has no `stream()`, which the writer's deflate reads through.
    vi.stubGlobal('Blob', NodeBlob);
    URL.createObjectURL = vi.fn(() => 'blob:shapes');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers the written PDF as a download rather than saving it', async () => {
    const { container } = render(<PdfDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write PDF' }));
    const link = await screen.findByRole('link', { name: /Download shapes\.pdf/ }, { timeout: 10_000 });
    expect(link.getAttribute('href')).toBe('blob:shapes');
    expect(link.getAttribute('download')).toBe('shapes.pdf');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/pdf');
    expect(new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
    expect(screen.queryByText(/left out/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
