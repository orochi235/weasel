import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickFile } from '@weasel-js/editor';
import { chooseImage } from './pipelineRun';

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
    const picks = { current: 0 };
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
    const picks = { current: 0 };
    const first = chooseImage(picks);
    expect(await chooseImage(picks)).toBeNull();
    const image = { close: vi.fn() } as unknown as ImageBitmap;
    await vi.waitFor(() => expect(decoded).toBeDefined(), { timeout: 10_000 });
    decoded(image);
    expect(await first).toBe(image);
  });
});
