#!/usr/bin/env node
/**
 * A batch's whole fleet run: `test:fleet` and `test:fleet:postbuild` on one commit at once, each on
 * its own node, with one exit status. Either failing stops the other.
 *
 *   npm run test:batch                 # HEAD
 *   npm run test:batch -- <commit>     # any commit; further flags go to test:fleet
 *
 * The suite is placed first; the postbuild then goes to the usable node with the most free cores
 * that the suite's jobs left alone (`scripts/lib/fleet-nodes.mjs`), or wherever onto puts it when
 * no such node is free.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fleetNodes, usableNodes } from './lib/fleet-nodes.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`test-batch: ${line}`);
const PLACE_WAIT_MS = 120_000;

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
        to.write(`${prefix}${line}\n`);
      }
    });
    stream.on('end', () => rest && to.write(`${prefix}${rest}\n`));
  }
  const exit = new Promise((done) => child.on('close', (code, signal) => done(signal ? 1 : (code ?? 1))));
  return { child, exit };
};

const placed = new Set();
let placements = 0;
let expected = Infinity;
let onPlaced = () => {};
const tests = start('scripts/fleet-test.mjs', [ref, ...args], {
  onLine: (line) => {
    const launching = /^fleet-test: launching (\d+) jobs?/.exec(line);
    if (launching) expected = Number(launching[1]);
    const job = /^fleet-test: placed \S+ job \S+ on (\S+)/.exec(line);
    if (job) {
      placed.add(job[1]);
      placements += 1;
    }
    if (placements >= expected) onPlaced();
  },
});

const outcome = { tests: undefined, postbuild: undefined };
let postbuild;
tests.exit.then((status) => {
  outcome.tests ??= status;
  onPlaced();
  if (status !== 0 && postbuild && outcome.postbuild === undefined) {
    say(`test:fleet failed (${status}); stopping the postbuild`);
    postbuild.child.kill('SIGTERM');
    outcome.postbuild = 'stopped';
  }
});

// The postbuild waits for the suite's placement, so it can go to a node the suite left free.
await new Promise((done) => {
  onPlaced = done;
  setTimeout(done, PLACE_WAIT_MS).unref();
});

if (outcome.tests !== undefined && outcome.tests !== 0) outcome.postbuild = 'not started';
else {
  let node;
  try {
    [node] = usableNodes(await fleetNodes(), { avoid: [...placed], minFree: 4 }).sort((a, b) => b.free - a.free);
  } catch {}
  say(`postbuild on ${node ? `${node.name} (${node.free} cores free)` : "the node onto picks, since every free node holds the suite"}`);
  postbuild = start('scripts/fleet-ci.mjs', ['postbuild', ref, ...(node ? ['--node', node.name] : [])], { prefix: 'postbuild| ' });
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
