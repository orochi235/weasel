/**
 * The `weaselforge` command line: any argv parses to one of its four answers without throwing, a parsed command
 * written back out reads as itself whatever its paths hold, and help wins wherever it is asked for. `outDirPolicy`
 * against a model of paths as segment lists: it refuses exactly an output that is or holds the current directory,
 * and empties exactly one strictly inside the vite root.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, text } from '../pbt.fixture';
import { parseCli } from './parse';
import { outDirPolicy } from './policy';

const RUNS = 300;

const token = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('dev', 'build', '--config', 'x.ts', '--out', 'dist', '-h', '--help', '--', '--config=a', '--out=', 'extra', '-x', '--nope', '-') },
  { weight: 1, arbitrary: text },
);

describe('parseCli', () => {
  it('answers any argv with one of its four commands, and never throws', () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.oneof(fc.array(token, { maxLength: 6 }), fc.tuple(fc.constantFrom('dev', 'build'), fc.array(token, { maxLength: 2 })).map(([c, rest]) => [c, ...rest])), (argv) => {
        const cli = parseCli(argv);
        expect(['dev', 'build', 'help', 'usage']).toContain(cli.command);
        seen.count(cli.command);
        if (cli.command === 'usage') expect(cli.error).not.toBe('');
        if (cli.command === 'dev') expect(Object.keys(cli).sort()).toEqual(['command', 'config']);
      }),
      runs(RUNS),
    );
    for (const command of ['dev', 'build', 'help', 'usage']) seen.atLeast(command, 5);
  });

  it('reads a command written back out as itself, whatever its paths hold', () => {
    fc.assert(
      fc.property(fc.constantFrom('dev', 'build'), text, fc.option(text, { nil: undefined }), fc.boolean(), (command, config, out, split) => {
        const outFlag = command === 'build' && out !== undefined ? [`--out=${out}`] : [];
        const argv = split ? [`--config=${config}`, ...outFlag, command] : [command, `--config=${config}`, ...outFlag];
        expect(parseCli(argv)).toEqual({ command, config, ...(outFlag.length > 0 ? { out } : {}) });
        expect(parseCli(['--', command])).toEqual({ command, config: 'vite.config.ts' });
      }),
      runs(RUNS),
    );
  });

  it('answers help wherever -h or --help stands among well-formed options', () => {
    fc.assert(
      fc.property(fc.constantFrom('dev', 'build'), fc.constantFrom('-h', '--help'), fc.nat(2), (command, flag, at) => {
        const argv = [command, '--config=a.ts'];
        argv.splice(at, 0, flag);
        expect(parseCli(argv)).toEqual({ command: 'help' });
      }),
      runs(RUNS),
    );
  });
});

const name = fc.constantFrom('a', 'b', 'é', '..a', 'a..', '...', 'x y');
const step = fc.oneof({ weight: 3, arbitrary: name }, { weight: 1, arbitrary: fc.constantFrom('..', '.', '') });

/** Absolute segments after applying `steps` to `from`, as POSIX `resolve` would. */
function walk(from: readonly string[], steps: readonly string[]): string[] {
  const out = [...from];
  for (const s of steps) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out;
}

const startsWith = (long: readonly string[], short: readonly string[]) => short.every((s, i) => long[i] === s);

describe('outDirPolicy', () => {
  it('refuses an output that is or holds the current directory, and empties one strictly inside the root', () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.array(name, { maxLength: 3 }), fc.array(step, { maxLength: 4 }), fc.boolean(), fc.array(step, { maxLength: 3 }), (cwdSegs, outSteps, absolute, rootSteps) => {
        const cwd = `/${cwdSegs.join('/')}`;
        const out = absolute ? `/${outSteps.join('/')}` : outSteps.join('/');
        const root = rootSteps.join('/') || '.';
        const outDir = walk(out.startsWith('/') ? [] : cwdSegs, outSteps);
        const rootDir = walk(root.startsWith('/') ? [] : cwdSegs, rootSteps);
        const policy = outDirPolicy(out, cwd, root);
        if (startsWith(cwdSegs, outDir)) {
          expect(policy.ok).toBe(false);
          seen.count('refused');
          return;
        }
        expect(policy).toEqual({ ok: true, outDir: `/${outDir.join('/')}`, emptyOutDir: outDir.length > rootDir.length && startsWith(outDir, rootDir) });
        seen.count(policy.ok && policy.emptyOutDir ? 'emptied' : 'kept');
      }),
      runs(RUNS),
    );
    for (const what of ['refused', 'emptied', 'kept']) seen.atLeast(what, 20);
  });
});
