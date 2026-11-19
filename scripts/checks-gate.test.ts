import { describe, expect, it } from 'vitest';
import { runChecks } from './checks-gate.mjs';
import { longestFirst } from './lib/ci-steps.mjs';

const tick = () => new Promise((done) => setTimeout(done, 1));

describe('runChecks', () => {
  it('runs every check, and returns the ones that failed with their output', async () => {
    const ran: string[] = [];
    const failures = await runChecks([['check:a'], ['check:b'], ['lint']], {
      jobs: 2,
      runOne: async ([name]: string[]) => {
        ran.push(name);
        await tick();
        return name === 'check:b' ? { ok: false, output: 'b broke' } : { ok: true, output: '' };
      },
    });
    expect(ran.sort()).toEqual(['check:a', 'check:b', 'lint']);
    expect(failures).toEqual([{ args: ['check:b'], output: 'b broke' }]);
  });

  it('runs at most `jobs` at once', async () => {
    let live = 0;
    let most = 0;
    await runChecks([['a'], ['b'], ['c'], ['d'], ['e']], {
      jobs: 2,
      runOne: async () => {
        most = Math.max(most, ++live);
        await tick();
        live -= 1;
        return { ok: true, output: '' };
      },
    });
    expect(most).toBe(2);
  });

  it('reports each check as it ends, with its position', async () => {
    const seen: string[] = [];
    await runChecks([['a'], ['b']], {
      jobs: 1,
      runOne: async () => ({ ok: true, output: '' }),
      report: ({ args, at, of }: { args: string[]; at: number; of: number }) => seen.push(`${at}/${of} ${args[0]}`),
    });
    expect(seen).toEqual(['1/2 a', '2/2 b']);
  });
});

describe('longestFirst', () => {
  it('starts the slowest checks first and keeps the rest in order', () => {
    const order = longestFirst([['check:size'], ['typecheck'], ['lint'], ['typecheck:packages']]).map(([name]) => name);
    expect(order).toEqual(['typecheck:packages', 'typecheck', 'check:size', 'lint']);
  });
});
