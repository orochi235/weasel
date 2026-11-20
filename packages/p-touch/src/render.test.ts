import { describe, expect, it, vi } from 'vitest';
import { Printers } from 'obwat';
import { renderLabel } from './render';
import { tapeForWidthMm } from './tape';

const core = vi.hoisted(() => ({
  renderSceneToPixels: vi.fn(async () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) })),
  warmRender: vi.fn(async () => {}),
}));
vi.mock('@weasel-js/core', () => core);

describe('renderLabel', () => {
  const tape = tapeForWidthMm(12)!;
  const geometry = { length: 144, tape, media: Printers.ptP710bt.media(12)!, scene: {} as never };
  const background = async (over: object) => {
    await renderLabel({ ...geometry, ...over });
    return (core.renderSceneToPixels.mock.lastCall as unknown as [{ background?: string }])[0].background;
  };

  it('draws on white when the background is left out or undefined, and on what it names otherwise', async () => {
    expect(await background({})).toBe('#ffffff');
    expect(await background({ background: undefined })).toBe('#ffffff');
    expect(await background({ background: '#ff0000' })).toBe('#ff0000');
  });
});
