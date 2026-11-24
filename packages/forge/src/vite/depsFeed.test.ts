// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import type { ComponentGraph } from '../story/types';

const builds: ((graph: ComponentGraph) => void)[] = [];

vi.mock('./componentGraph.ts', () => ({
  clientResolver: () => async () => null,
  createComponentGraph: () => ({
    build: () => new Promise<ComponentGraph>((done) => builds.push(done)),
    invalidate: () => false,
    reset: () => {},
  }),
}));
vi.mock('./history.ts', () => ({ createHistoryReader: () => ({ read: async () => ({}) }) }));
vi.mock('./virtualModules.ts', () => ({ invalidateVirtual: () => {} }));

const { createDepsFeed } = await import('./depsFeed');

const graph = (source: string): ComponentGraph => ({ A: { source } }) as unknown as ComponentGraph;
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('createDepsFeed', () => {
  it('drops a rebuild that was running when reset, and rebuilds nothing more until a page asks again', async () => {
    const feed = createDepsFeed({ root: () => '/repo', index: () => [], logError: (err) => { throw err; } });
    const send = vi.fn();
    const server = { ws: { send } } as unknown as ViteDevServer;

    const served = feed.module(async () => null);
    builds.shift()!(graph('old.tsx'));
    await served;

    feed.redeps(server);
    expect(builds).toHaveLength(1);
    feed.reset();
    builds.shift()!(graph('older.tsx'));
    await settle();
    expect(send).not.toHaveBeenCalled();

    feed.redeps(server);
    expect(builds).toHaveLength(0);
  });
});
