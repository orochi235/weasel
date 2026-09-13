import { parseArgs } from 'node:util';

export type Cli =
  | { command: 'dev'; config: string }
  | { command: 'build'; config: string; out?: string }
  | { command: 'help' }
  | { command: 'usage'; error: string };

export const USAGE = `usage: weaselforge dev [--config <vite config>]
       weaselforge build [--config <vite config>] [--out <dir>]

--config defaults to vite.config.ts in the current directory.
`;

const usage = (error: string): Cli => ({ command: 'usage', error });

export function parseCli(argv: string[]): Cli {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        config: { type: 'string' },
        out: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    return usage(err instanceof Error ? err.message : String(err));
  }
  const { values, positionals } = parsed;
  if (values.help) return { command: 'help' };
  const [command, ...rest] = positionals;
  if (command === undefined) return usage('no command given');
  if (command !== 'dev' && command !== 'build') return usage(`unknown command: ${command}`);
  if (rest.length > 0) return usage(`unexpected argument: ${rest[0]}`);
  const config = values.config ?? 'vite.config.ts';
  if (command === 'dev') return values.out === undefined ? { command, config } : usage('--out applies only to build');
  return values.out === undefined ? { command, config } : { command, config, out: values.out };
}
