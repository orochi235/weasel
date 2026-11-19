/**
 * The night's control sweep: one browser job on the fleet at the frozen commit, before the reviews.
 * Each dead control becomes a finding, in the reviewers' format, for one fixer job of its own.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ontoArgs, readRun } from '../control-sweep/fleet.mjs';
import { fix } from './area.mjs';
import { JOB_IN } from './config.mjs';
import { BUSY, BUSY_WAIT_MS, ontoOnce } from './jobs.mjs';

export const SWEEP_ID = 'control-sweep';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A dead control as a reviewer-format finding. */
export const findingOf = (d) => [
  `## Dead control: ${d.kind} "${d.label}" in demo \`${d.demo}\``,
  `- where: ${d.path} (demo \`${d.demo}\`)`,
  `- scenario: operating it${d.precondition ? ` with "${d.precondition}" operated first` : ''} changes no canvas pixel and no text or attribute in the demo outside the control's own field, on two fresh loads`,
  `- evidence: control sweep${d.shots?.length ? `; screenshots ${d.shots.map((s) => `\`${s}\``).join(', ')} in the night's sweep record` : ''}`,
  '- severity: medium',
  '',
].join('\n');

export const findingsOf = (dead) => `${dead.map(findingOf).join('\n')}`;

/** What the fixer is told its findings are. */
export const sweepSource = (commit, report) => [
  `The control sweep (\`scripts/control-sweep.mjs\`) operated every control of every demo at the frozen commit ${commit}`,
  `in headless Chromium. Each finding in \`${report}\` is a control whose operation changed nothing the sweep could`,
  'see. Either it is dead, and the fix wires it or hides it where it has no effect (as labkit\'s `showIf` does),',
  'or the sweep cannot see what it does (it acts only once something is selected, or on the next gesture): report',
  'that as `not a defect (why)`, and name the `scripts/control-sweep.allow.json` entry a person should add. Never add',
  'one yourself.',
].join('\n');

/** The dead records of a finished run, in full, from its `controls.jsonl`. */
const deadIn = (dir) => {
  const file = join(dir, 'controls.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.verdict === 'dead');
};

/** Runs the sweep and answers `{ ran, exit, summary, dead, minutes, why }`; its run lands in `<night>/control-sweep/run`. */
export const runControlSweep = async (ctx) => {
  const dir = join(ctx.nightDir, SWEEP_ID);
  const to = join(dir, 'run');
  mkdirSync(dir, { recursive: true });
  const log = createWriteStream(join(dir, 'onto.log'), { flags: 'a' });
  const t0 = Date.now();
  const args = ontoArgs({
    run: `night-round${ctx.round}`, to, ref: ctx.base, task: `skulk${ctx.round}-control-sweep`,
    about: `Control sweep for audit round ${ctx.round}: operates every demo control at ${ctx.commit.slice(0, 10)} and lists each that changes nothing.`,
  });
  try {
    for (;;) {
      const run = await ontoOnce(args, ctx.frozen, log);
      if (!BUSY.test(run.stderr)) break;
      await sleep(BUSY_WAIT_MS);
    }
  } finally {
    log.end();
  }
  const minutes = (Date.now() - t0) / 60_000;
  const { exit, summary } = readRun(to);
  if (exit === undefined || !summary) return { ran: false, minutes, why: `no record came back; see ${join(dir, 'onto.log')}` };
  return { ran: true, exit, summary, dead: deadIn(to), minutes };
};

/** One fixer job on the sweep's dead controls. Answers its result, as `area.mjs`'s `fix` does. */
export const fixSweep = async (ctx, dead) => {
  const inDir = join(ctx.frozen, JOB_IN, SWEEP_ID);
  mkdirSync(inDir, { recursive: true });
  const report = `${JOB_IN}/${SWEEP_ID}/A.md`;
  writeFileSync(join(ctx.frozen, report), findingsOf(dead));
  const out = join(ctx.nightDir, SWEEP_ID);
  writeFileSync(join(out, 'findings.md'), findingsOf(dead));
  const fixed = await fix(ctx, { id: SWEEP_ID }, sweepSource(ctx.commit, report));
  if (fixed.report) writeFileSync(join(out, 'fix.md'), fixed.report);
  return fixed;
};

/** The night's sweep line, for the log and the report. */
export const sweepLine = (s) => (s.skipped ? `control sweep: ${s.skipped}`
  : !s.ran ? `control sweep: did not run (${s.why})`
    : `control sweep: ${s.summary.dead} dead, ${s.summary.unsure} unsure, ${s.summary.skipped} skipped of ${s.summary.controls} controls in ${s.summary.demos} demos, ${s.minutes.toFixed(1)} min`);
