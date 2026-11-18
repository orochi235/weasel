import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const registered = vi.hoisted(() => [] as unknown[]);
vi.mock('@weasel-js/renderer', async (importOriginal) => {
  const renderer = await importOriginal<typeof import('@weasel-js/renderer')>();
  return {
    ...renderer,
    registerTexture: (img: never) => { registered.push(img); return renderer.registerTexture(img); },
  };
});

const images = vi.hoisted(() => [] as { onload: (() => void) | null }[]);
vi.stubGlobal('Image', class { onload: (() => void) | null = null; src = ''; width = 1; height = 1; constructor() { images.push(this); } });

const { CustomShaderDemo } = await import('../CustomShaderDemo');

afterEach(cleanup);

describe('CustomShaderDemo', () => {
  it('loads and registers its texture once, however many mounts start before the image arrives', async () => {
    render(<StrictMode><CustomShaderDemo /></StrictMode>);
    render(<CustomShaderDemo />);
    expect(images).toHaveLength(1);
    await act(async () => { for (const img of images) img.onload?.(); });
    expect(registered).toHaveLength(1);
  });
});
