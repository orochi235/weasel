#!/usr/bin/env node
/**
 * A batch's whole fleet run: `test:fleet` and `test:fleet:postbuild` on one commit at once, each on
 * its own node, with one exit status. Either failing stops the other.
 *
 *   npm run test:batch                 # HEAD
 *   npm run test:batch -- <commit>     # any commit; further flags go to test:fleet
 *
 * onto places the suite's jobs and the postbuild; neither is pinned to a node.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`test-batch: ${line}`);

const args = process.argv.slice(2);
const ref = args[0] && !args[0].startsWith('-') ? args.shift() : 'HEAD';

/** Spawns a node script, relaying its lines with `prefix` and handing each to `onLine`. */
const start = (script, argv, { prefix = '', onLine = () => {} } = {}) => {
  const child = spawn(process.execPath, [script, ...argv], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const [stream, to] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) {
        onLine(line);
        to.write(`${line.startsWith('fleet-fail:') ? '' : prefix}${line}\n`);
      }
    });
    stream.on('end', () => rest && to.write(`${prefix}${rest}\n`));
  }
  const exit = new Promise((done) => child.on('close', (code, signal) => done(signal ? 1 : (code ?? 1))));
  return { child, exit };
};

const tests = start('scripts/fleet-test.mjs', [ref, ...args]);

const outcome = { tests: undefined, postbuild: undefined };
let postbuild;
tests.exit.then((status) => {
  outcome.tests ??= status;
  if (status !== 0 && postbuild && outcome.postbuild === undefined) {
    say(`test:fleet failed (${status}); stopping the postbuild`);
    postbuild.child.kill('SIGTERM');
    outcome.postbuild = 'stopped';
  }
});

// onto places the postbuild, as it does the suite: a node chosen here at launch can fill up while others sit idle.
if (outcome.tests !== undefined && outcome.tests !== 0) outcome.postbuild = 'not started';
else {
  say("postbuild on the node onto picks");
  postbuild = start('scripts/fleet-ci.mjs', ['postbuild', ref], { prefix: 'postbuild| ' });
  const status = await postbuild.exit;
  if (outcome.postbuild === undefined) outcome.postbuild = status;
  if (status !== 0 && outcome.tests === undefined) {
    say(`test:fleet:postbuild failed (${status}); stopping the suite`);
    tests.child.kill('SIGTERM');
    outcome.tests = 'stopped';
  }
}
await tests.exit;

const verdict = (v) => (v === 0 ? 'passed' : typeof v === 'number' ? `failed (${v})` : v);
say(`test:fleet ${verdict(outcome.tests)}, test:fleet:postbuild ${verdict(outcome.postbuild)}`);
const failed = [outcome.tests, outcome.postbuild].some((v) => v !== 0);
process.exit(failed ? 1 : 0);
