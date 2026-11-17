import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { pickFile } from '@weasel-js/editor';
import { createLatest } from '@weasel-js/registry';
import { chooseImage, useSourceImage } from './pipelineRun';

vi.mock('@weasel-js/editor', async (original) => ({ ...(await original<object>()), pickFile: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(pickFile).mockReset();
});

describe('chooseImage', () => {
  it('gives way to an image picked while it decodes, whichever decode finishes first', async () => {
    const decodes: { resolve: (b: ImageBitmap) => void }[] = [];
    vi.stubGlobal('createImageBitmap', () => new Promise<ImageBitmap>((resolve) => { decodes.push({ resolve }); }));
    vi.mocked(pickFile).mockResolvedValue(new File([new Uint8Array(4)], 'a.png'));
    const picks = createLatest();
    const slow = chooseImage(picks);
    const fast = chooseImage(picks);
    await vi.waitFor(() => expect(decodes).toHaveLength(2), { timeout: 10_000 });
    const late = { close: vi.fn() } as unknown as ImageBitmap;
    const next = { close: vi.fn() } as unknown as ImageBitmap;
    decodes[1]?.resolve(next);
    expect(await fast).toBe(next);
    decodes[0]?.resolve(late);
    expect(await slow).toBeNull();
    expect(late.close).toHaveBeenCalled();
  });

  it('leaves a decode running when a later picker is canceled', async () => {
    let decoded!: (b: ImageBitmap) => void;
    vi.stubGlobal('createImageBitmap', () => new Promise<ImageBitmap>((resolve) => { decoded = resolve; }));
    vi.mocked(pickFile).mockResolvedValueOnce(new File([new Uint8Array(4)], 'a.png')).mockResolvedValueOnce(null);
    const picks = createLatest();
    const first = chooseImage(picks);
    expect(await chooseImage(picks)).toBeNull();
    const image = { close: vi.fn() } as unknown as ImageBitmap;
    await vi.waitFor(() => expect(decoded).toBeDefined(), { timeout: 10_000 });
    decoded(image);
    expect(await first).toBe(image);
  });
});

describe('useSourceImage', () => {
  const image = () => ({ close: vi.fn() }) as unknown as ImageBitmap;

  it('closes a replaced image once the runner is idle, and the last one on unmount', async () => {
    let idle!: () => void;
    const runner = {
      setSources: vi.fn(),
      idle: vi.fn(() => new Promise<void>((resolve) => { idle = resolve; })),
    };
    const { result, unmount } = renderHook(() => useSourceImage());
    const card = image();
    const photo = image();
    act(() => result.current.replace(card, runner));
    act(() => result.current.replace(photo, runner));
    expect(runner.setSources).toHaveBeenLastCalledWith({ image: photo });
    expect(result.current.sources).toEqual({ image: photo });
    expect(card.close).not.toHaveBeenCalled();
    idle();
    await vi.waitFor(() => expect(card.close).toHaveBeenCalled());
    unmount();
    idle();
    await vi.waitFor(() => expect(photo.close).toHaveBeenCalled());
  });
});
