import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextShapingDemo } from '../TextShapingDemo';

const FONTS = resolve('apps/site/assets/fonts');

describe('TextShapingDemo', () => {
  beforeEach(() => {
    // jsdom fetches nothing from the dev server: answer each face's URL from the file it names.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const bytes = readFileSync(resolve(FONTS, basename(String(url))));
      return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const shapedCount = () => Number(screen.getByLabelText('shaped glyphs').textContent);

  it('shapes the Devanagari conjunct into fewer glyphs than its characters', async () => {
    render(<TextShapingDemo />);
    await waitFor(() => expect(shapedCount()).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.click(screen.getByRole('radio', { name: 'क्ष' }));
    expect(shapedCount()).toBeLessThan([...'क्ष'].length);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shapes an Arabic word in the Arabic face', async () => {
    render(<TextShapingDemo />);
    await waitFor(() => expect(shapedCount()).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.click(screen.getByRole('radio', { name: 'سلام' }));
    expect(shapedCount()).toBe(4);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
