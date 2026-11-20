/**
 * How a run lands what its fixers made: each mbox onto its own `audit<N>-<area>` branch, the branches into
 * the batch, the record committed there, the fleet run on its tip, and `main` fast-forwarded when green.
 * The fleet run through the fast-forward holds the merge lock, so runs land one at a time.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyFix, catchUpWithMain, commitRecord, fastForwardMain, makeBatch, removeWorktree, runFleetScript } from './batch.mjs';
import { waitForLease } from './lease.mjs';
import { mergeLock } from './runs.mjs';
import { SWEEP_ID } from './sweep.mjs';

const CO_AUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
/** How many times a green batch merges a moved main in and tests again before leaving the fast-forward to fail. */
const MAIN_CATCH_UPS = 2;

/** Each fixer's mbox onto its own `audit<N>-<area>` branch. Answers the branches that took their patches. */
export const patchAreas = ({ root, round, commit, nightDir, results, outcomes, say }) => {
  const branches = [];
  for (const summary of results) {
    const mbox = join(nightDir, 'areas', summary.id, 'fix.mbox');
    if (!existsSync(mbox)) {
      outcomes[summary.id] = summary.distinct > 0 ? 'no commits' : 'nothing to fix';
      continue;
    }
    const applied = applyFix(root, { round, area: summary.id, commit, mbox });
    if (applied.error) {
      outcomes[summary.id] = 'patches did not apply';
      say(`patch ${summary.id}: did not apply: ${applied.error}`);
      continue;
    }
    summary.fixCommits = applied.commits;
    branches.push(applied.branch);
    say(`patch ${summary.id}: ${applied.commits.length} commits on ${applied.branch}`);
  }
  return branches;
};

/** The sweep fixer's mbox onto `audit<N>-control-sweep`, added to `branches`. Answers its commits and patches. */
export const patchSweep = ({ root, round, commit, fixed, branches, outcomes, say }) => {
  if (!fixed.mbox) {
    outcomes[SWEEP_ID] = 'no commits';
    return { patches: 0, commits: [], report: fixed.report };
  }
  const applied = applyFix(root, { round, area: SWEEP_ID, commit, mbox: fixed.mbox });
  if (applied.error) {
    outcomes[SWEEP_ID] = 'patches did not apply';
    say(`patch ${SWEEP_ID}: did not apply: ${applied.error}`);
    return { patches: fixed.patches, commits: [], report: fixed.report };
  }
  branches.push(applied.branch);
  say(`patch ${SWEEP_ID}: ${applied.commits.length} commits on ${applied.branch}`);
  return { patches: fixed.patches, commits: applied.commits, report: fixed.report, costUsd: fixed.usage?.costUsd };
};

/** Tests the batch on the fleet, merging a moved `main` in first and between passes. Answers the tip to land, or `{ report }`. */
const testBatch = async ({ root, batch, nightDir, merge, say, tip }) => {
  const logName = batch.name.replace(/\//g, '-');
  const catchUp = () => {
    const caught = catchUpWithMain(batch.tree);
    if (caught.moved) {
      tip = caught.tip;
      say(`batch: main moved; merged it in at ${tip.slice(0, 10)} and testing that`);
    }
    return caught;
  };
  const kept = `${batch.name} and its branches kept; worktree ${batch.tree}`;
  // Another run may have landed while this one waited for the lock: test with its work in, not twice.
  if (merge && catchUp().conflict) return { report: `untested: merging main into the batch conflicts: ${kept}` };
  for (let pass = 1; ; pass++) {
    const suffix = pass === 1 ? '' : `.${pass}`;
    const log = join(nightDir, `${logName}${suffix}.test-batch.log`);
    const status = await runFleetScript(root, 'test:batch', batch.name, log);
    say(`fleet: test:batch ${status === 0 ? 'passed' : `failed (${status}); its last test-batch: line in ${log} says which part`}`);
    if (status !== 0) return { report: `red: ${batch.name} and its branches kept; worktree ${batch.tree}; logs in ${nightDir}` };
    if (!merge || pass === MAIN_CATCH_UPS + 1) return { tip };
    const caught = catchUp();
    if (caught.conflict) return { report: `green, but main moved and merging it conflicts: ${kept}` };
    if (!caught.moved) return { tip };
  }
};

/** Merges the branches into the batch, records the round there, runs the fleet on its tip, and merges if green. */
export const batchAndTest = async ({ root, git, round, commit, date, nightDir, branches, results, sweep, outcomes, merge, say, setStep }) => {
  const batch = makeBatch(root, { round, date, commit, branches });
  const idOf = (branch) => branch.replace(`audit${round}-`, '');
  for (const branch of batch.merged) outcomes[idOf(branch)] = `\`${branch}\``;
  for (const branch of batch.conflicted) {
    outcomes[idOf(branch)] = `\`${branch}\`, left out: merge conflict`;
    const area = results.find((s) => s.id === idOf(branch));
    if (area) area.fixCommits = [];
    say(`batch: ${branch} conflicts; left out`);
  }
  const recorded = commitRecord(batch.tree, { round, commit, date, nightDir, areas: results, sweep, outcomes, coAuthor: CO_AUTHOR });
  say(`record: docs/audits/round-${round}/ committed on ${batch.name} at ${recorded.slice(0, 10)}`);

  setStep('merge-wait');
  const release = await waitForLease(mergeLock(), { round }, {
    onWait: (holder) => say(`batch: waiting for the merge lock${holder?.round ? `, held by round ${holder.round}` : ''}`),
  });
  try {
    setStep('fleet');
    const tested = await testBatch({ root, batch, nightDir, merge, say, tip: recorded });
    if (tested.report) return tested.report;
    removeWorktree(root, batch.tree);
    if (!merge) return `green; --no-merge, so main is untouched and ${batch.name} and its branches are kept`;
    const result = fastForwardMain(root, tested.tip);
    if (result.startsWith('main fast-forwarded')) for (const b of [...batch.merged, batch.name]) git('branch', '-D', b);
    return result;
  } finally {
    release();
  }
};
