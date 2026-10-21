import { execFile } from 'node:child_process';
import { cpus } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(execFile);

const times = () => cpus().map((c) => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));

/** The GPU's utilization in percent from IOAccelerator, or null where there is none to read. */
const gpuPercent = async () => {
  try {
    const { stdout } = await run('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator']);
    const m = /"Device Utilization %"=(\d+)/.exec(stdout);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
};

/**
 * How busy this machine is over `ms`: the cores' summed busy share, and the GPU's highest reading.
 * CPU time rather than the load average, whose minute-long window still holds the job's own setup.
 */
export const sampleLoad = async (ms = 1000) => {
  const before = times();
  const gpu = [await gpuPercent()];
  await new Promise((r) => setTimeout(r, ms / 2));
  gpu.push(await gpuPercent());
  await new Promise((r) => setTimeout(r, ms / 2));
  gpu.push(await gpuPercent());
  const after = times();
  const busy = after.reduce((sum, c, i) => sum + 1 - (c.idle - before[i].idle) / (c.total - before[i].total || 1), 0);
  const readings = gpu.filter((g) => g !== null);
  return { cores: after.length, busy, gpu: readings.length ? Math.max(...readings) : null };
};

/**
 * How the browser project shares a node with the rest. It keeps `reserve` cores and jsdom gets the
 * idle ones left, so long as that is at least `minJsdomWorkers`. Measured 2026-10-21 over R = 1-4 on
 * 10-, 14- and 18-core nodes (`scripts/bench-overlap-reserve.mjs`): no browser test timed out at any R,
 * jsdom timed out on the 10-core node at R 1-2, and R 3 ran fastest on 18 cores.
 */
export const LIMITS = { reserve: 3, minJsdomWorkers: 4, gpu: 30 };

/** Whether `load` leaves room to run the browser project beside the rest, the jsdom workers it leaves,
 *  and the reading that decided it. */
export const roomToOverlap = ({ cores, busy, gpu }, limits = LIMITS) => {
  const reading = `${busy.toFixed(1)} of ${cores} cores busy${gpu === null ? '' : `, GPU ${gpu}%`}`;
  const jsdomWorkers = Math.floor(cores - busy) - limits.reserve;
  const ok = jsdomWorkers >= limits.minJsdomWorkers && (gpu === null || gpu <= limits.gpu);
  return ok ? { ok, jsdomWorkers, reading } : { ok, reading };
};
