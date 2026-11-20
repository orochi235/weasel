import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_GLOBAL, sceneToWire, type PageApi, type PageRequest } from './protocol';
import { FIXTURE_RENDER, fixtureScene } from './testing/fixtureScene';

/** Each session the page opens: whether its context is lost, and how many renders it drew. */
const sessions: Array<{ lost: boolean; loseNext: boolean; renders: number; disposed: boolean }> = [];

vi.mock('@weasel-js/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...real,
    warmRender: async () => {},
    createRasterSession: (options: { createCanvas?: (w: number, h: number) => unknown } = {}) => {
      const state = { lost: false, loseNext: false, renders: 0, disposed: false };
      sessions.push(state);
      let gl: { isContextLost(): boolean } | null = null;
      return {
        render: () => {
          if (state.loseNext) state.lost = true;
          if (!gl) {
            const canvas = options.createCanvas!(1, 1) as HTMLCanvasElement;
            gl = canvas.getContext('webgl2') as unknown as { isContextLost(): boolean };
          }
          if (state.lost) throw new Error('raster session: the WebGL2 context is lost — dispose this session and open another');
          state.renders++;
          return { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 4]) };
        },
        dispose: () => { state.disposed = true; },
      };
    },
  };
});

const { serveHeadlessPage } = await import('./page');
const root = globalThis as unknown as Record<string, PageApi | undefined>;
const request = (): PageRequest => ({
  scene: JSON.parse(JSON.stringify(sceneToWire(fixtureScene()))) as object, ...FIXTURE_RENDER, format: 'rgba',
});

beforeEach(() => {
  sessions.length = 0;
  // jsdom has no WebGL: each canvas's context reports its session's loss.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext() {
    const state = sessions.at(-1)!;
    return { isContextLost: () => state.lost } as never;
  });
});
afterEach(() => {
  delete root[PAGE_GLOBAL];
  vi.restoreAllMocks();
});

describe('headless page, context loss', () => {
  it('opens a new session for the next render once its context is lost between renders', async () => {
    serveHeadlessPage();
    await root[PAGE_GLOBAL]!.render(request());
    sessions[0]!.lost = true;
    await expect(root[PAGE_GLOBAL]!.render(request())).resolves.toMatchObject({ width: 1, height: 1 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.disposed).toBe(true);
    expect(sessions[1]!.renders).toBe(1);
  });

  it('fails the render its context is lost during, and opens a new session for the next', async () => {
    serveHeadlessPage();
    await root[PAGE_GLOBAL]!.render(request());
    sessions[0]!.loseNext = true;
    await expect(root[PAGE_GLOBAL]!.render(request())).rejects.toThrow(/context is lost/);
    expect(sessions).toHaveLength(2);
    await expect(root[PAGE_GLOBAL]!.render(request())).resolves.toMatchObject({ width: 1, height: 1 });
    expect(sessions[1]!.renders).toBe(1);
  });
});
