// An `npm` that `changeset publish` finds first on PATH during a release.
//
// A publish retried while npm still holds the version as staged fails with
// `E409 … Cannot publish over previously staged version` (npm/cli#9889). That
// version is already uploaded, so it is not a failure — but changesets reads it
// as one and stops publishing the dependency chunks after it. This reports it
// to changesets as a success; `check:published --wait` then decides whether it
// ever lists. Every other command and every other failure passes through as is.
//
// `scripts/release.mjs` puts this on PATH and names the real npm in
// WEASEL_REAL_NPM (a JSON `[command, ...args]`).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Whether a failed publish's output is the staged-version conflict. */
export function isStagedConflict({ stdout = '', stderr = '' }) {
  const text = `${stdout}\n${stderr}`;
  return /E409/.test(text) && /previously staged version/i.test(text);
}

/**
 * @param {string[]} args
 * @param {{
 *   run: (args: string[], opts: { capture: boolean }) => Promise<{ code: number, stdout?: string, stderr?: string }>,
 *   out: (s: string) => void,
 *   err: (s: string) => void,
 * }} io
 * @returns {Promise<number>} the exit code to report
 */
export async function shimNpm(args, { run, out, err }) {
  if (args[0] !== 'publish') return (await run(args, { capture: false })).code;

  const result = await run(args, { capture: true });
  if (result.code !== 0 && isStagedConflict(result)) {
    err(
      '[npm-shim] E409 "previously staged version": npm already holds this upload and has not ' +
        'listed it yet. Reporting success; check:published --wait decides whether it lands.\n',
    );
    return 0;
  }
  if (result.stdout) out(result.stdout);
  if (result.stderr) err(result.stderr);
  return result.code;
}

function realRun(args, { capture }) {
  const [cmd, ...pre] = JSON.parse(process.env.WEASEL_REAL_NPM ?? '["npm"]');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...pre, ...args], { stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await shimNpm(process.argv.slice(2), {
    run: realRun,
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  });
  process.exit(code);
}
