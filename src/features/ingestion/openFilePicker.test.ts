import { describe, it, expect } from 'vitest';
import { openFilePicker } from './openFilePicker';

describe('openFilePicker', () => {
  it('resolves the chosen files and removes its input', async () => {
    const p = openFilePicker({ accept: 'image/*', multiple: true });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('image/*');
    expect(input.multiple).toBe(true);
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [f] });
    input.dispatchEvent(new Event('change'));
    await expect(p).resolves.toEqual([f]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('resolves [] on cancel', async () => {
    const p = openFilePicker();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    input.dispatchEvent(new Event('cancel'));
    await expect(p).resolves.toEqual([]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
});
