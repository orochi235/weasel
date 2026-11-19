#!/usr/bin/env node
/**
 * Operates every control in every demo of the demo site in headless Chromium and reports each one that
 * changes nothing: no canvas pixel and no DOM text or attribute in the demo outside the control's own
 * field. Runs on a fleet node with a browser (`npm run sweep:controls` sends it there); never here.
 *
 *   node scripts/control-sweep.mjs [--only id,id] [--out dir] [--run name] [--url <site>/weasel/]
 *     [--skip-packages] [--no-build] [--concurrency N] [--settle ms] [--update-allow]
 *
 * Writes `<out>/<run>/`: `controls.jsonl` (one record per control), `demos.jsonl`, `summary.json`,
 * and before/after screenshots of dead controls under `shots/`. Keeps the newest 7 runs in `<out>`.
 * Exits 1 when a control is dead and not waived in `scripts/control-sweep.allow.json`.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sweepDemo } from './control-sweep/demo.mjs';
import { deadTable, demosIn, pruneRuns, readAllow, staleWaivers, waiverFor, writeAllow } from './control-sweep/judge.mjs';
import { installSweepKit } from './control-sweep/page-kit.mjs';
import { buildSite, serveDir } from './control-sweep/serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOW = join(ROOT, 'scripts/control-sweep.allow.json');
const KEEP_RUNS = 7;
const VIEWPORT = { width: 1280, height: 1400 };

export const parseArgs = (argv) => {
  const value = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i < 0 ? fallback : argv[i + 1];
  };
  return {
    only: value('--only')?.split(',').filter(Boolean),
    out: resolve(value('--out', join(ROOT, '.control-sweep'))),
    run: value('--run', new Date().toISOString().replace(/[:.]/g, '-')),
    url: value('--url'),
    build: !argv.includes('--no-build'),
    packages: !argv.includes('--skip-packages'),
    concurrency: Math.max(1, Number(value('--concurrency', 3)) || 3),
    settleMs: Math.max(0, Number(value('--settle', 150)) || 0),
    updateAllow: argv.includes('--update-allow'),
  };
};

/** What a page did that a sweep must not: a native dialog, a download, a file picker, a new window. */
const watchEvents = (context, page) => {
  let what;
  page.on('dialog', (d) => {
    what ??= 'opens a native dialog';
    d.dismiss().catch(() => {});
  });
  page.on('download', (d) => {
    what ??= 'starts a download';
    d.cancel().catch(() => {});
  });
  page.on('filechooser', () => { what ??= 'opens a file picker'; });
  context.on('page', (p) => {
    what ??= 'opens a window';
    p.close().catch(() => {});
  });
  return { reset: () => { what = undefined; }, what: () => what };
};

const count = (records, verdict) => records.filter((r) => r.verdict === verdict).length;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const runDir = join(args.out, args.run);
  const shotsDir = join(runDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });
  writeFileSync(join(runDir, 'started'), String(started));
  const pruned = pruneRuns(args.out, KEEP_RUNS);
  const say = (line) => {
    console.log(line);
    appendFileSync(join(runDir, 'sweep.log'), `${line}\n`);
  };
  if (pruned.length) say(`pruned ${pruned.length} old run(s) from ${args.out}`);

  const all = demosIn(readFileSync(join(ROOT, 'apps/site/registry.ts'), 'utf8'));
  const unknown = (args.only ?? []).filter((id) => !all.some((d) => d.id === id));
  if (unknown.length) throw new Error(`no demo named ${unknown.join(', ')}`);
  const demos = args.only ? all.filter((d) => args.only.includes(d.id)) : all;
  const allow = readAllow(ALLOW);

  let server;
  let base = args.url;
  if (!base) {
    const site = join(args.out, '.site');
    if (args.build) buildSite(ROOT, site, { packages: args.packages, say });
    server = await serveDir(site);
    base = server.url;
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  say(`sweeping ${demos.length} demos at ${base} in Chromium ${browser.version()}, ${args.concurrency} at once`);

  const records = [];
  const demoRows = [];
  const onRecord = (rec) => {
    const waiver = rec.verdict === 'dead' ? waiverFor(allow, rec.demo, rec.label) : undefined;
    if (waiver) Object.assign(rec, { verdict: 'waived', reason: waiver.reason });
    records.push(rec);
    appendFileSync(join(runDir, 'controls.jsonl'), `${JSON.stringify(rec)}\n`);
  };
  let done = 0;
  const queue = [...demos];
  const worker = async () => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, acceptDownloads: false });
    await context.addInitScript(installSweepKit);
    const page = await context.newPage();
    const events = watchEvents(context, page);
    for (let demo = queue.shift(); demo; demo = queue.shift()) {
      let row;
      try {
        const r = await sweepDemo(page, demo, { base, settleMs: args.settleMs, events, shotsDir, onRecord });
        row = { demo: demo.id, controls: r.records.length, dead: count(r.records, 'dead'), steadyLoad: r.steadyLoad, ms: r.ms };
      } catch (error) {
        row = { demo: demo.id, error: String(error.message ?? error).split('\n')[0] };
      }
      demoRows.push(row);
      appendFileSync(join(runDir, 'demos.jsonl'), `${JSON.stringify(row)}\n`);
      done += 1;
      say(`${done}/${demos.length} ${demo.id}: ${row.error ? `did not load (${row.error})` : `${row.controls} controls, ${row.dead} dead`}`);
    }
    await context.close();
  };
  try {
    await Promise.all(Array.from({ length: Math.min(args.concurrency, demos.length) }, worker));
  } finally {
    await browser.close();
    await server?.close();
  }

  const dead = records.filter((r) => r.verdict === 'dead');
  const swept = new Set(demos.map((d) => d.id));
  const waivedNow = new Set(records.filter((r) => r.verdict === 'waived').map((r) => `${r.demo}\u0000${r.label}`));
  const stale = staleWaivers(allow, swept, waivedNow);
  const summary = {
    run: args.run, host: hostname(), started: new Date(started).toISOString(), minutes: Number(((Date.now() - started) / 60000).toFixed(1)),
    demos: demos.length, loadFailures: demoRows.filter((r) => r.error).length, controls: records.length,
    ...Object.fromEntries(['alive', 'dead', 'unsure', 'skipped', 'waived', 'error'].map((v) => [v, count(records, v)])),
    deadControls: dead.map(({ demo, path, label, kind, precondition, shots }) => ({ demo, path, label, kind, precondition, shots })),
    loadErrors: demoRows.filter((r) => r.error),
    staleWaivers: stale,
  };
  writeFileSync(join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
  say(`swept ${summary.demos} demos, ${summary.controls} controls in ${summary.minutes} min: ${summary.dead} dead, ${summary.unsure} unsure, ${summary.skipped} skipped, ${summary.waived} waived, ${summary.error} errors, ${summary.loadFailures} demos failed to load`);
  if (stale.length) {
    say(`${stale.length} allowlist entr${stale.length === 1 ? 'y waives' : 'ies waive'} nothing now${args.updateAllow ? '; removed' : '; --update-allow removes them'}:`);
    for (const e of stale) say(`  ${e.demo}: ${e.control}`);
    if (args.updateAllow) writeAllow(ALLOW, allow.filter((e) => !stale.includes(e)));
  }
  if (dead.length) say(`\ndead controls:\n${deadTable(dead)}`);
  say(`records: ${runDir}`);
  return dead.length > 0 ? 1 : 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`control-sweep: ${error.stack ?? error}`);
      process.exit(2);
    },
  );
}
