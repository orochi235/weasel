import { describe, expect, it, vi } from 'vitest';
import type { Browser } from 'playwright-core';
import { planPixelRender, loadScene, type SavedScene } from '@weasel-js/core';
import { regionRenderArgs } from '@weasel-js/export';
import { createNodeRasterHost, type NodeRenderArgs } from './host';
import { PAGE_GLOBAL, sceneFromWire, sceneToWire } from './protocol';
import { FIXTURE_RENDER, fixtureScene } from './testing/fixtureScene';

describe('node raster host', () => {
  it('sends a scene the page reads back into the same draw commands', () => {
    const scene = fixtureScene();
    const wire = JSON.parse(JSON.stringify(sceneToWire(scene))) as object;
    const plan = (s: typeof scene | ReturnType<typeof loadScene>) =>
      planPixelRender({ scene: s, ...FIXTURE_RENDER, background: '#ffffff' });
    expect(JSON.parse(JSON.stringify(plan(loadScene(sceneFromWire(wire) as SavedScene<unknown, string, unknown>))))).toEqual(JSON.parse(JSON.stringify(plan(scene))));
  });

  it("takes core's regionRenderArgs as they are, and draws the same region from them", () => {
    const scene = fixtureScene();
    const region = { ...FIXTURE_RENDER.sourceRect, name: 'Fixture' };
    const args: NodeRenderArgs = regionRenderArgs(scene, region, { scale: 2, background: '#ffffff' });
    const rest = { sourceRect: args.sourceRect, scale: args.scale, background: args.background! };
    const wire = JSON.parse(JSON.stringify(sceneToWire(scene))) as object;
    const read = loadScene(sceneFromWire(wire) as SavedScene<unknown, string, unknown>);
    expect(JSON.parse(JSON.stringify(planPixelRender({ scene: read, ...rest }))))
      .toEqual(JSON.parse(JSON.stringify(planPixelRender({ scene, ...rest }))));
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
        newPage: async () => ({ on: () => {}, addScriptTag: async () => { throw new Error('bad script'); } }),
      }),
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/bad script/);
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).not.toHaveBeenCalled();
  });

  it("rethrows open's own failure when closing what it opened also fails", async () => {
    const browser = {
      newContext: async () => ({
        close: async () => { throw new Error('context already closed'); },
        newPage: async () => ({ on: () => {}, addScriptTag: async () => { throw new Error('bad script'); } }),
      }),
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/bad script/);
  });

  it('opens a new page before rendering once the one it had crashed while idle', async () => {
    let pages = 0;
    const crash: Array<() => void> = [];
    const browser = {
      close: vi.fn(async () => {}),
      isConnected: () => true,
      newContext: async () => {
        const n = ++pages;
        let evaluated = 0;
        return {
          close: vi.fn(async () => {}),
          newPage: async () => ({
            on: (event: string, fn: () => void) => { if (event === 'crash') crash[n - 1] = fn; },
            addScriptTag: async () => {},
            isClosed: () => false,
            evaluate: async () => {
              if (evaluated++ === 0) return true;
              return { width: 1, height: 1, base64: Buffer.from([n, n, n, n]).toString('base64') };
            },
          }),
        };
      },
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    expect(Array.from((await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).data)).toEqual([1, 1, 1, 1]);
    crash[0]!();
    expect(Array.from((await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).data)).toEqual([2, 2, 2, 2]);
    expect(pages).toBe(2);
    await host.dispose();
  });

  /** A browser whose one page answers every render with `result`. */
  function fakeBrowser(result: { width: number; height: number; base64: string }) {
    const close = vi.fn(async () => {});
    let evaluated = 0;
    // The first evaluate is the open's check that the page script ran.
    const page = {
      on: () => {}, addScriptTag: async () => {}, isClosed: () => false,
      evaluate: vi.fn(async () => (evaluated++ === 0 ? true : result)),
    };
    const browser = { close, isConnected: () => true, newContext: async () => ({ close, newPage: async () => page }) } as unknown as Browser;
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

  it("sends renderSceneToPixels's camera, layers and pixelRatio to the page", async () => {
    const { browser, page } = fakeBrowser({ width: 1, height: 1, base64: Buffer.from([1, 2, 3, 4]).toString('base64') });
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    const args: NodeRenderArgs = {
      scene: fixtureScene(), ...FIXTURE_RENDER, camera: { x: 1, y: 2, scale: { x: 3, y: 3 } }, layers: ['scene'], pixelRatio: 2,
    };
    await host.render(args);
    expect(page.evaluate.mock.calls.at(-1)).toMatchObject([
      expect.any(Function), [expect.any(String), { camera: args.camera, layers: ['scene'], pixelRatio: 2 }],
    ]);
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
            on: () => {},
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

  it('opens a new page for the next render once the one it had has crashed', async () => {
    let pages = 0;
    const closeContext = vi.fn(async () => {});
    const browser = {
      close: vi.fn(async () => {}),
      isConnected: () => true,
      newContext: async () => {
        const n = ++pages;
        let evaluated = 0;
        let onCrash: (() => void) | null = null;
        return {
          close: closeContext,
          newPage: async () => ({
            on: (event: string, fn: () => void) => { if (event === 'crash') onCrash = fn; },
            addScriptTag: async () => {},
            // A crashed page is not closed: every call on it throws from then on.
            isClosed: () => false,
            evaluate: async () => {
              if (evaluated++ === 0) return true;
              if (n === 1) { onCrash?.(); throw new Error('Target crashed'); }
              return { width: 1, height: 1, base64: Buffer.from([7, 7, 7, 7]).toString('base64') };
            },
          }),
        };
      },
    } as unknown as Browser;
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/crashed/);
    const image = await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER });
    expect(Array.from(image.data)).toEqual([7, 7, 7, 7]);
    expect(pages).toBe(2);
    expect(closeContext).toHaveBeenCalledTimes(1);
    await host.dispose();
  });

  it('waits on dispose for the browser of a page it dropped to finish closing', async () => {
    let finish!: () => void;
    const closeBrowser = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    let evaluated = 0;
    const browser = {
      close: closeBrowser,
      isConnected: () => true,
      newContext: async () => ({
        close: vi.fn(async () => {}),
        newPage: async () => ({
          on: () => {}, addScriptTag: async () => {}, isClosed: () => evaluated > 1,
          evaluate: async () => {
            if (evaluated++ === 0) return true;
            throw new Error('Target page, context or browser has been closed');
          },
        }),
      }),
    } as unknown as Browser;
    vi.doMock('playwright-core', () => ({ chromium: { launch: async () => browser } }));
    try {
      const host = createNodeRasterHost({ pageScript: 'x' });
      await expect(host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).rejects.toThrow(/closed/);
      expect(closeBrowser).toHaveBeenCalledTimes(1);
      let disposed = false;
      const disposing = host.dispose().then(() => { disposed = true; });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(disposed).toBe(false);
      finish();
      await disposing;
      expect(disposed).toBe(true);
    } finally {
      vi.doUnmock('playwright-core');
    }
  });

  /** A browser whose page runs what the host evaluates here, and runs `script` when the host adds its page script. */
  function scriptedBrowser(script: (raise: (err: Error) => void) => void) {
    const listeners = new Map<string, (err: Error) => void>();
    const close = vi.fn(async () => {});
    const page = {
      on: (event: string, fn: (err: Error) => void) => { listeners.set(event, fn); },
      addScriptTag: async () => { script((err) => listeners.get('pageerror')?.(err)); },
      isClosed: () => false,
      evaluate: async <A, R>(fn: (arg: A) => R, arg: A) => fn(arg),
    };
    return { close, isConnected: () => true, newContext: async () => ({ close, newPage: async () => page }) } as unknown as Browser;
  }

  it('serves a page script that calls serveHeadlessPage once its fonts load', async () => {
    const root = globalThis as Record<string, unknown>;
    const browser = scriptedBrowser(() => {
      setTimeout(() => {
        root[PAGE_GLOBAL] = { render: async () => ({ width: 1, height: 1, base64: Buffer.from([5, 5, 5, 5]).toString('base64') }) };
      }, 30);
    });
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    try {
      expect(Array.from((await host.render({ scene: fixtureScene(), ...FIXTURE_RENDER })).data)).toEqual([5, 5, 5, 5]);
    } finally {
      delete root[PAGE_GLOBAL];
      await host.dispose();
    }
  });

  it('rejects with the error a page script threw before serving', async () => {
    const browser = scriptedBrowser((raise) => raise(new Error('registerFont: no such font')));
    const host = createNodeRasterHost({ browser, pageScript: 'x' });
    const rendering = host.render({ scene: fixtureScene(), ...FIXTURE_RENDER });
    await expect(rendering).rejects.toThrow(/threw before calling `serveHeadlessPage`: registerFont: no such font/);
    await expect(rendering).rejects.toMatchObject({ cause: { message: 'registerFont: no such font' } });
  });
});
