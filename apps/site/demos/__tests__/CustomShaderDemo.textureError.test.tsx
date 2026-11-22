import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const images = vi.hoisted(() => [] as { onload: (() => void) | null; onerror: (() => void) | null }[]);
vi.stubGlobal('Image', class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 1;
  height = 1;
  constructor() { images.push(this); }
});

const { CustomShaderDemo } = await import('../CustomShaderDemo');

afterEach(cleanup);

describe('CustomShaderDemo', () => {
  it('loads its texture afresh on the next mount after a failed load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = render(<CustomShaderDemo />);
    expect(images).toHaveLength(1);
    await act(async () => { images[0]!.onerror?.(); });
    first.unmount();
    render(<CustomShaderDemo />);
    expect(images).toHaveLength(2);
  });
});
