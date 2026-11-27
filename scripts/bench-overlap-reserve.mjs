// How many cores the browser project needs left to it when it runs beside the rest: runs the fleet's
// suite with the overlap forced on and the jsdom process given `cores - R` workers, for each R asked.
// Every run's whole log and one JSON line of its numbers go to --out as the run finishes.
//
// `off` in --reserves runs the suite without the overlap, as the baseline.
//
//   node scripts/bench-overlap-reserve.mjs --node teitou --reserves off,2,4 --reps 3 --out .bench/overlap-reserve
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { join } from 'node:path';
import { cli } from './lib/help.mjs';
import { sampleLoad } from './lib/node-load.mjs';

const { values } = cli(import.meta.url, {
  summary: "How many cores the browser project needs left to it beside the rest: runs the suite with the overlap forced on and jsdom given `cores - R` workers, for each R. Every run's log and one JSON line go to --out as it finishes.",
  options: {
    reserves: { type: 'string', placeholder: '<R,R|off>', default: '4', description: 'cores to reserve, each a trial; `off` runs without the overlap as the baseline' },
    reps: { type: 'string', placeholder: '<n>', default: '1', description: 'passes over every reserve' },
    node: { type: 'string', placeholder: '<name>', default: hostname().split('.')[0], description: 'the node name recorded on each row' },
    out: { type: 'string', placeholder: '<dir>', default: '.bench/overlap-reserve', description: 'where logs and runs.jsonl go' },
  },
});
const reserves = values.reserves.split(',').map((r) => (r === 'off' ? 'off' : Number(r)));
const reps = Number(values.reps);
const cores = cpus().length;
const node = values.node;
const PROJECTS = ['core', 'site', 'weasel-ui', 'draw', 'labkit', 'forge', 'forge-node', 'smoke', 'browser', 'forge-stories', 'gate'];
mkdirSync(values.out, { recursive: true });

/** The tests a vitest log names after `FAIL`, and the ones it says timed out, with their projects. */
function outcomes(lines) {
  const failed = lines.filter((l) => /^\s*(×|FAIL)\s/.test(l) && l.includes(' > ')).map((l) => l.trim());
  const timedOut = [];
  lines.forEach((l, i) => {
    if (!/Test timed out in/.test(l)) return;
    const named = lines.slice(Math.max(0, i - 6), i).reverse().find((p) => p.includes(' > '));
    timedOut.push((named ?? l).trim());
  });
  return { failed, timedOut };
}

const trial = (reserve, log) =>
  new Promise((resolve) => {
    const started = Date.now();
    const off = reserve === 'off';
    const jsdomWorkers = off ? null : Math.max(1, cores - reserve);
    const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', WEASEL_OVERLAP: off ? '0' : '1' };
    if (!off) env.WEASEL_JSDOM_WORKERS = String(jsdomWorkers);
    const args = ['scripts/vitest-overlap.mjs', 'run', '--reporter=default', ...PROJECTS.map((p) => `--project=${p}`)];
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const take = (d) => {
      text += d;
      appendFileSync(log, d);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => {
      const lines = text.split('\n');
      const durations = [...text.matchAll(/Duration\s+([\d.]+)s/g)].map((m) => Number(m[1]));
      resolve({ code, jsdomWorkers, wallSeconds: (Date.now() - started) / 1000, processSeconds: durations, ...outcomes(lines) });
    });
  });

const total = reserves.length * reps;
let n = 0;
for (const reserve of reserves) {
  for (let rep = 1; rep <= reps; rep++) {
    n++;
    const id = `${node}-R${reserve}-rep${rep}`;
    const before = await sampleLoad();
    const r = await trial(reserve, join(values.out, `${id}.log`));
    const row = { node, cores, reserve, rep, at: new Date().toISOString(), loadBefore: before, ...r };
    appendFileSync(join(values.out, 'runs.jsonl'), JSON.stringify(row) + '\n');
    console.log(
      `${String(n).padStart(2)}/${total}  ${node}  R=${String(reserve).padStart(3)}  rep ${rep}  ` +
        `${r.wallSeconds.toFixed(1).padStart(6)}s  timed out ${String(r.timedOut.length).padStart(2)}  ` +
        `failed ${String(r.failed.length).padStart(2)}  busy before ${before.busy.toFixed(1).padStart(4)}  exit ${r.code}`,
    );
  }
}
writeFileSync(join(values.out, `${node}-done`), `${n} runs\n`);
