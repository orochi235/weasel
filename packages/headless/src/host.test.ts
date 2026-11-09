import { describe, expect, it, vi } from 'vitest';
import type { Browser } from 'playwright-core';
import { planPixelRender, sceneFromJSON, type SavedScene } from '@weasel-js/core';
import { createNodeRasterHost } from './host';
import { sceneFromWire, sceneToWire } from './protocol';
import { FIXTURE_RENDER, fixtureScene } from './testing/fixtureScene';

describe('node raster host', () => {
  it('sends a scene the page reads back into the same draw commands', () => {
    const scene = fixtureScene();
    const wire = JSON.parse(JSON.stringify(sceneToWire(scene))) as object;
    const plan = (s: typeof scene | ReturnType<typeof sceneFromJSON>) =>
      planPixelRender({ scene: s, ...FIXTURE_RENDER, background: '#ffffff' });
    expect(JSON.parse(JSON.stringify(plan(sceneFromJSON(sceneFromWire(wire) as SavedScene<unknown, string, unknown>))))).toEqual(JSON.parse(JSON.stringify(plan(scene))));
  });

  it('launches nothing until a render, and refuses one once disposed', async () => {
    const host = createNodeRasterHost({ pageScript: 'unused' });
    await host.dispose();
    await host.dispose();
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/disposed/);
  });

  it('closes the context it opened in a caller\'s browser when the page script fails', async () => {
    const closeContext = vi.fn(async () => {});
    const closeBrowser = vi.fn(async () => {});
    const browser = {
      close: closeBrowser,
      newContext: async () => ({
        close: closeContext,
        newPage: async () => ({ addScriptTag: async () => { throw new Error('bad script'); } }),
      }),
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/bad script/);
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).not.toHaveBeenCalled();
  });

  /** A browser whose one page answers every render with `result`. */
  function fakeBrowser(result: { width: number; height: number; base64: string }) {
    const close = vi.fn(async () => {});
    let evaluated = 0;
    // The first evaluate is the open's check that the page script ran.
    const page = { addScriptTag: async () => {}, evaluate: vi.fn(async () => (evaluated++ === 0 ? true : result)) };
    const browser = { close, newContext: async () => ({ close, newPage: async () => page }) } as unknown as Browser;
    return { browser, page };
  }

  it('hands back pixels that own their buffer, however small', async () => {
    const { browser } = fakeBrowser({ width: 1, height: 1, base64: Buffer.from([1, 2, 3, 4]).toString('base64') });
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    const image = await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER });
    expect(Array.from(image.data)).toEqual([1, 2, 3, 4]);
    expect(image.data.byteOffset).toBe(0);
    expect(image.data.buffer.byteLength).toBe(4);
    await host.dispose();
  });

  it('refuses a render the host was disposed under while its page opened', async () => {
    const { browser, page } = fakeBrowser({ width: 1, height: 1, base64: '' });
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    const rendering = host.render({ scene: fixtureScene(), ...FIXTURE_RENDER });
    const disposing = host.dispose();
    await expect(rendering).rejects.toThrow(/disposed/);
    await disposing;
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it('opens a new page for the next render once the one it had has closed', async () => {
    let pages = 0;
    const closeContext = vi.fn(async () => {});
    const browser = {
      close: vi.fn(async () => {}),
      isConnected: () => true,
      newContext: async () => {
        const n = ++pages;
        let closed = false;
        let evaluated = 0;
        return {
          close: closeContext,
          newPage: async () => ({
            addScriptTag: async () => {},
            isClosed: () => closed,
            evaluate: async () => {
              if (evaluated++ === 0) return true;
              if (n === 1) { closed = true; throw new Error('Target page, context or browser has been closed'); }
              return { width: 1, height: 1, base64: Buffer.from([9, 9, 9, 9]).toString('base64') };
            },
          }),
        };
      },
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/closed/);
    const image = await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER });
    expect(Array.from(image.data)).toEqual([9, 9, 9, 9]);
    expect(pages).toBe(2);
    expect(closeContext).toHaveBeenCalledTimes(1);
    await host.dispose();
  });
});
