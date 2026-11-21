/**
 * How a fleet run's suite is placed: one `onto test` job, or the browser project as a job of its own beside one running
 * everything else. onto places both (2026-11-20): a part pinned to the node that looked best at launch waited hours there
 * once that node filled up while others sat idle. `vitest-overlap.mjs` reads which part a job is from its suite scope.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { killJob, ontoWhenFree } from './commit-tree.mjs';

const runLine = (tree) => readFileSync(join(tree, '.onto/tests'), 'utf8').split('\n').find((l) => l.startsWith('run:')) ?? '';

/** Whether to try a node of its own for the browser project: the plan runs it, and nothing pinned the run's placement. */
export const wantsSplit = (plan, ontoArgs, env = process.env) =>
  /--project=browser\b/.test(plan) &&
  env.WEASEL_FLEET_SPLIT !== '0' &&
  !ontoArgs.some((a) => /^--?(node|spread|in)(=|$)/.test(a));

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
  if (!wantsSplit(runLine(tree), ontoArgs)) {
    say('launching 1 job');
    return ontoWhenFree([...testArgs, '--scope', scope, ...ontoArgs], { say, onJob: onJob('suite') });
  }
  say('launching 2 jobs');
  const parts = [
    { part: 'rest', args: [...testArgs, '--scope', `${scope}-rest`, ...ontoArgs] },
    { part: 'browser', args: [...testArgs, '--scope', 'browser', ...ontoArgs], prefix: 'browser| ' },
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
