import { describe, expect, it } from 'vitest';
import { buildAll, buildGraph } from './build-workspaces.mjs';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('buildGraph', () => {
  it('keeps sibling dependencies and peers, and adds undeclared build reads', () => {
    const graph = buildGraph(
      [
        { name: 'a' },
        { name: 'b', dependencies: { a: '1', react: '1' } },
        { name: 'c', peerDependencies: { b: '1' } },
      ],
      { c: ['a'] },
    );
    expect(graph).toEqual(new Map([['a', []], ['b', ['a']], ['c', ['b', 'a']]]));
  });

  it('keeps a devDependency unless it leads back to the package', () => {
    const graph = buildGraph(
      [
        { name: 'theme' },
        { name: 'core', dependencies: { geom: '1' }, devDependencies: { theme: '1', labkit: '1' } },
        { name: 'geom' },
        { name: 'labkit', dependencies: { core: '1' } },
        { name: 'text', devDependencies: { path: '1' } },
        { name: 'path', devDependencies: { text: '1' } },
      ],
      {},
    );
    expect(graph.get('core')).toEqual(['geom', 'theme']);
    expect(graph.get('text')).toEqual([]);
    expect(graph.get('path')).toEqual([]);
  });
});

describe('buildAll', () => {
  it('builds each workspace after its dependencies', async () => {
    const graph = new Map([['a', []], ['b', ['a']], ['c', ['a']], ['d', ['b', 'c']]]);
    const order: string[] = [];
    expect(await buildAll(graph, async (n) => (await tick(), order.push(n), 0), 4)).toBeNull();
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    expect(order).toHaveLength(4);
  });

  it('runs no more than `jobs` builds at once', async () => {
    const graph = new Map(['a', 'b', 'c', 'd', 'e'].map((n) => [n, [] as string[]]));
    let now = 0;
    let most = 0;
    await buildAll(graph, async () => {
      most = Math.max(most, ++now);
      await tick();
      now--;
      return 0;
    }, 2);
    expect(most).toBe(2);
  });

  it('starts nothing after a failure and names it', async () => {
    const graph = new Map([['a', []], ['b', ['a']], ['c', ['b']]]);
    const started: string[] = [];
    const failed = await buildAll(graph, (n) => (started.push(n), n === 'b' ? 2 : 0), 1);
    expect(failed).toEqual({ name: 'b', code: 2 });
    expect(started).toEqual(['a', 'b']);
  });

  it('refuses a cycle', async () => {
    const graph = new Map([['a', ['b']], ['b', ['a']]]);
    await expect(buildAll(graph, () => 0, 2)).rejects.toThrow(/cycle/);
  });
});
