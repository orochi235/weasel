import { Blob as NodeBlob } from 'node:buffer';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('writes both halves of the canvas as labeled pages and offers the file as a download', async () => {
    const { container } = render(<PdfDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write PDF' }));
    const link = await screen.findByRole('link', { name: /Download shapes\.pdf/ }, { timeout: 10_000 });
    expect(link.getAttribute('download')).toBe('shapes.pdf');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
