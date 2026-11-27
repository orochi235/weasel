/**
 * One declaration per command line: a script names its flags, positionals and subcommands once,
 * and both the parse and its `-h` / `--help` text come from that table.
 *
 *   const { values, positionals } = cli(import.meta.url, {
 *     summary: 'Runs the suite on the fleet against a commit.',
 *     positionals: '[<commit>]',
 *     options: { since: { type: 'string', placeholder: '<ref>', description: '…' } },
 *   });
 *
 * Parsing is `util.parseArgs` with `strict`, so a flag the table leaves out is an error (exit 2).
 * A script that hands its other flags to another tool says `passthrough: true`; they come back in
 * `rest`, in order, with every positional after the first of them.
 */
import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = { type: 'boolean', short: 'h', description: 'print this help and exit' };

/** The `parseArgs` options in a spec's table, with the help flag added and the help-only keys left out. */
function parseOptionsOf(options = {}) {
  const out = { help: { type: 'boolean', short: 'h' } };
  for (const [name, { type, short, multiple, default: fallback }] of Object.entries(options)) {
    out[name] = { type, ...(short && { short }), ...(multiple && { multiple }), ...(fallback !== undefined && { default: fallback }) };
  }
  return out;
}

/** The left-hand column for one option: `-n, --dry-run` or `    --since <ref>`. */
function flagOf(name, { type, short, placeholder, bare }) {
  const shown = placeholder ?? '<value>';
  const value = type !== 'string' ? '' : bare !== undefined ? `[=${shown}]` : ` ${shown}`;
  return `${short ? `-${short}, ` : '    '}--${name}${value}`;
}

/** The right-hand column for one option, with its default when it has a telling one. */
function describedOf({ description = '', default: fallback, multiple, bare }) {
  const repeat = `${multiple ? ' (repeatable)' : ''}${bare !== undefined ? ` (alone: ${bare})` : ''}`;
  const shown = fallback === undefined || fallback === false || (Array.isArray(fallback) && fallback.length === 0);
  return `${description}${repeat}${shown ? '' : ` (default: ${Array.isArray(fallback) ? fallback.join(',') : fallback})`}`;
}

/** The one-line usage for `name` under `spec`. */
export function usageLineOf(name, spec) {
  const parts = [name];
  if (spec.commands) parts.push('<command>');
  parts.push('[options]');
  if (spec.positionals) parts.push(spec.positionals);
  if (spec.passthrough) parts.push('[…flags for the tool it runs]');
  return `usage: ${parts.join(' ')}`;
}

/** The whole `--help` text for `name` under `spec`. */
export function helpOf(name, spec) {
  const lines = [usageLineOf(name, spec), '', spec.summary.trim()];
  if (spec.commands) {
    lines.push('', 'Commands:');
    const width = Math.max(...Object.keys(spec.commands).map((c) => c.length));
    for (const [command, sub] of Object.entries(spec.commands)) {
      lines.push(`  ${command.padEnd(width)}  ${sub.summary.trim().split('\n')[0]}`);
    }
    lines.push('', `Run \`${name} <command> --help\` for a command's own options.`);
  }
  const rows = Object.entries({ help: HELP, ...spec.options }).map(([n, o]) => [flagOf(n, o), describedOf(o)]);
  const width = Math.max(...rows.map(([flag]) => flag.length));
  lines.push('', 'Options:', ...rows.map(([flag, text]) => `  ${flag.padEnd(width)}  ${text}`.trimEnd()));
  if (spec.notes) lines.push('', spec.notes.trim());
  return `${lines.join('\n')}\n`;
}

/** Splits a passthrough command line: the script's own tokens, and the rest from the first flag it doesn't know. */
function splitPassthrough(argv, options) {
  const known = new Set();
  for (const [name, { short }] of Object.entries(options)) {
    known.add(`--${name}`);
    if (short) known.add(`-${short}`);
  }
  const takesValue = new Set(
    Object.entries(options)
      .filter(([, o]) => o.type === 'string')
      .flatMap(([name, { short }]) => [`--${name}`, ...(short ? [`-${short}`] : [])]),
  );
  const own = [];
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      rest.push(...argv.slice(i + 1));
      break;
    }
    const flag = arg.startsWith('-') ? arg.split('=')[0] : undefined;
    if (rest.length > 0 && !(flag && known.has(flag))) {
      rest.push(arg);
      continue;
    }
    if (flag && !known.has(flag)) {
      rest.push(arg);
      continue;
    }
    own.push(arg);
    if (flag && takesValue.has(flag) && !arg.includes('=') && i + 1 < argv.length) own.push(argv[++i]);
  }
  return { own, rest };
}

/** `arg` with the value its option takes alone filled in: `--wait` as `--wait=60`. */
function withBareValue(arg, options = {}) {
  for (const [name, { short, bare }] of Object.entries(options)) {
    if (bare !== undefined && (arg === `--${name}` || (short && arg === `-${short}`))) return `--${name}=${bare}`;
  }
  return arg;
}

/**
 * How many positionals a usage string like `<from> [<to>]` or `<file>…` takes: each word is one,
 * `[…]` makes it optional and a trailing `…` (or `...`) lets it repeat.
 */
export function arityOf(positionals = '') {
  let min = 0;
  let max = 0;
  for (const word of positionals.match(/\[[^\]]*\]\S*|<[^>]*>\S*|\S+/g) ?? []) {
    const repeats = /(…|\.\.\.)\]?$/.test(word);
    if (!word.startsWith('[')) min += 1;
    max = repeats ? Infinity : max + 1;
  }
  return { min, max };
}

/**
 * Parses `argv` under `spec`. The answer is `{ help }` (text to print, exit 0), `{ error }` (exit 2),
 * or the parse: `{ command, values, positionals, rest }`.
 */
export function parseCli(name, spec, argv) {
  let command;
  let active = spec;
  let commandName = name;
  if (spec.commands) {
    const at = argv.findIndex((arg) => !arg.startsWith('-'));
    if (at >= 0 && spec.commands[argv[at]]) {
      command = argv[at];
      active = { ...spec.commands[command], options: { ...spec.options, ...spec.commands[command].options } };
      commandName = `${name} ${command}`;
      argv = [...argv.slice(0, at), ...argv.slice(at + 1)];
    }
  }
  const ownArgs = argv.includes('--') ? argv.slice(0, argv.indexOf('--')) : argv;
  if (ownArgs.includes('-h') || ownArgs.includes('--help')) return { help: helpOf(commandName, active) };
  const options = parseOptionsOf(active.options);
  const split = active.passthrough ? splitPassthrough(argv, options) : { own: argv, rest: [] };
  const { rest } = split;
  const own = split.own.map((arg) => withBareValue(arg, active.options));
  let parsed;
  try {
    parsed = parseArgs({ args: own, options, strict: true, allowPositionals: true });
  } catch (error) {
    // parseArgs follows its reason with advice about `--` that reads as noise here.
    return { error: `${error.message.split('. ')[0]}\n${usageLineOf(commandName, active)}\nRun \`${commandName} --help\` for the options.` };
  }
  const { help: _, ...values } = parsed.values;
  if (spec.commands && !command) {
    const named = parsed.positionals[0];
    const why = named ? `unknown command '${named}'` : 'a command is required';
    return { error: `${why}\n${usageLineOf(name, spec)}\nRun \`${name} --help\` for the commands.` };
  }
  const { min, max } = arityOf(active.positionals);
  const count = parsed.positionals.length;
  if (count > max) return { error: `unexpected argument '${parsed.positionals[max]}'\n${usageLineOf(commandName, active)}` };
  if (count < min) return { error: `missing ${active.positionals}\n${usageLineOf(commandName, active)}` };
  return { command, values, positionals: parsed.positionals, rest };
}

/**
 * Parses this process's arguments under `spec` for the script at `url` (named `node <path>` unless
 * `spec.name` says otherwise, as a `bin` does): prints the help and exits 0
 * on `-h` / `--help`, prints the error and usage and exits 2 on a flag or command it doesn't declare.
 */
export function cli(url, spec, argv = process.argv.slice(2)) {
  const name = spec.name ?? `node ${relative(process.cwd(), fileURLToPath(url))}`;
  const parsed = parseCli(name, spec, argv);
  if (parsed.help) {
    process.stdout.write(parsed.help);
    process.exit(0);
  }
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(2);
  }
  return parsed;
}
