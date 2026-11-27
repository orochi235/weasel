/** Answers `-h` / `--help` for a script, printing its leading doc comment, and exits 0 having done nothing else. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The text of the first `/** … *\/` block in `source`, without its comment markers. */
export function docOf(source) {
  const block = /\/\*\*([\s\S]*?)\*\//.exec(source)?.[1] ?? '';
  return block
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();
}

/** Prints the script at `url`'s doc comment and exits 0 when `args` asks for help. */
export function answerHelp(url, args) {
  if (!args.includes('-h') && !args.includes('--help')) return;
  console.log(docOf(readFileSync(fileURLToPath(url), 'utf8')));
  process.exit(0);
}
