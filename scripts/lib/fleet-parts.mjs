/**
 * How a fleet run's suite is placed: one `onto test` job, or the browser project on a node of its own
 * beside a job running everything else, on a node nobody is using when there is one. onto places a job by free cores, but the browser project
 * needs an idle GPU and nobody at the keyboard (`fleet-nodes.mjs`); run after the rest on a desk Mac
 * in use, it took 1.66× as long. `vitest-overlap.mjs` reads which part a job is from its suite scope.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { killJob, ontoWhenFree } from './commit-tree.mjs';
import { placeParts } from './fleet-nodes.mjs';

/** The browser part's tree on its node: its own, so the rest's job may land on the same node without waiting on it. */
export const BROWSER_TREE = 'weasel-browser';

const runLine = (tree) => readFileSync(join(tree, '.onto/tests'), 'utf8').split('\n').find((l) => l.startsWith('run:')) ?? '';

/** Whether to try a node of its own for the browser project: the plan runs it, and nothing pinned the run's placement. */
export const wantsSplit = (plan, ontoArgs, env = process.env) =>
  /--project=browser\b/.test(plan) &&
  env.WEASEL_FLEET_SPLIT !== '0' &&
  !ontoArgs.some((a) => /^--?(node|spread|in)(=|$)/.test(a));

/** The nodes a caller asked this run to stay off, such as the one `test:batch` gave the postbuild. */
const avoided = (env = process.env) => (env.WEASEL_FLEET_AVOID ?? '').split(',').filter(Boolean);

const minutes = (ms) => `${(ms / 60000).toFixed(1)} min`;

/**
 * Runs the suite and resolves to one exit status for every part. `jobs` collects each started job's
 * id, so a caller stopping the run can stop them too.
 */
export const runSuite = async ({ tree, base, scope, ontoArgs, say, jobs = [] }) => {
  const onJob = (part) => (job) => {
    jobs.push(job.id);
    say(`placed ${part} job ${job.id} on ${job.node}`);
  };
  const testArgs = ['test', '--dir', tree, '--ref', base];
  const pick = wantsSplit(runLine(tree), ontoArgs) ? await placeParts({ avoid: avoided() }) : undefined;
  if (pick) say(`browser node: ${pick.browser?.name ?? 'none free'}, rest node: ${pick.rest?.name ?? "onto's pick"} (${pick.readings})`);
  if (!pick?.browser) {
    say('launching 1 job');
    return ontoWhenFree([...testArgs, '--scope', scope, ...ontoArgs], { say, onJob: onJob('suite') });
  }
  say('launching 2 jobs');
  const parts = [
    { part: 'rest', args: [...testArgs, '--scope', `${scope}-rest`, ...(pick.rest ? ['--node', pick.rest.name] : []), ...ontoArgs] },
    { part: 'browser', args: [...testArgs, '--scope', 'browser', '--node', pick.browser.name, '--in', BROWSER_TREE, ...ontoArgs], prefix: 'browser| ' },
  ];
  const results = await Promise.all(parts.map(async ({ part, args, prefix }) => {
    const started = Date.now();
    const status = await ontoWhenFree(args, { say, prefix, onJob: onJob(part) });
    say(`${part} ${status === 0 ? 'passed' : `failed (${status})`} in ${minutes(Date.now() - started)} wall`);
    return status;
  }));
  return results.find((s) => s !== 0) ?? 0;
};

/** Stops every job in `jobs` when this process is told to stop, ahead of the tree's own cleanup. */
export const killOnSignal = (jobs) => {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.prependListener(signal, () => jobs.forEach(killJob));
};
