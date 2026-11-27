import { describe, expect, it } from 'vitest';
import { helpOf, parseCli, type CliSpec } from './help.mjs';

const spec: CliSpec = {
  summary: 'Does a thing.',
  positionals: '[<ref>]',
  options: {
    since: { type: 'string', placeholder: '<ref>', description: 'start here' },
    'dry-run': { type: 'boolean', short: 'n', description: 'change nothing' },
    jobs: { type: 'string', default: '4', description: 'how many at once' },
  },
};

describe('parseCli', () => {
  it('answers -h and --help with the table, ahead of anything else on the line', () => {
    for (const argv of [['-h'], ['--help'], ['HEAD', '--bogus', '--help']]) {
      expect(parseCli('x', spec, argv)).toEqual({ help: helpOf('x', spec) });
    }
  });

  it('renders each flag, its value and its default, aligned', () => {
    expect(helpOf('x', spec)).toBe(
      [
        'usage: x [options] [<ref>]',
        '',
        'Does a thing.',
        '',
        'Options:',
        '  -h, --help          print this help and exit',
        '      --since <ref>   start here',
        '  -n, --dry-run       change nothing',
        '      --jobs <value>  how many at once (default: 4)',
        '',
      ].join('\n'),
    );
  });

  it('rejects a flag the table leaves out', () => {
    const parsed = parseCli('x', spec, ['--bogus']);
    expect('error' in parsed && parsed.error).toMatch(/--bogus/);
  });

  it('rejects positionals when the spec declares none', () => {
    const parsed = parseCli('x', { summary: 's' }, ['stray']);
    expect('error' in parsed && parsed.error).toMatch(/unexpected argument 'stray'/);
  });

  it('parses what the table declares', () => {
    expect(parseCli('x', spec, ['HEAD', '--since=main', '-n'])).toEqual({
      command: undefined,
      values: { since: 'main', 'dry-run': true, jobs: '4' },
      positionals: ['HEAD'],
      rest: [],
    });
  });

  it('hands passthrough flags on, in order, with every positional after the first', () => {
    const parsed = parseCli('x', { ...spec, passthrough: true }, ['HEAD', '--node', 'studio', '--since', 'main', '--', '--raw']);
    expect(parsed).toMatchObject({ values: { since: 'main' }, positionals: ['HEAD'], rest: ['--node', 'studio', '--raw'] });
  });

  describe('commands', () => {
    const tool: CliSpec = {
      summary: 'A tool.',
      options: { verbose: { type: 'boolean', description: 'say more' } },
      commands: {
        run: { summary: 'Runs it.', positionals: '<file>', options: { fast: { type: 'boolean', description: 'go fast' } } },
        list: { summary: 'Lists them.' },
      },
    };

    it('lists the commands in the top-level help and gives each its own', () => {
      const top = parseCli('t', tool, ['--help']);
      expect('help' in top && top.help).toMatch(/Commands:\n {2}run {3}Runs it\.\n {2}list {2}Lists them\./);
      const sub = parseCli('t', tool, ['run', '--help']);
      expect('help' in sub && sub.help).toMatch(/^usage: t run \[options\] <file>/);
      expect('help' in sub && sub.help).toMatch(/--fast/);
    });

    it('parses a command with its options and the shared ones', () => {
      expect(parseCli('t', tool, ['--verbose', 'run', 'a.ts', '--fast'])).toMatchObject({
        command: 'run',
        values: { verbose: true, fast: true },
        positionals: ['a.ts'],
      });
    });

    it('rejects a missing or unknown command, and a command-only flag outside its command', () => {
      for (const argv of [[], ['nope'], ['list', '--fast']]) expect(parseCli('t', tool, argv)).toHaveProperty('error');
    });
  });
});
