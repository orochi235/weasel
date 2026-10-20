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

/** The most a node may be doing before a run keeps the browser project out of the jsdom phase. */
export const LIMITS = { busyShare: 0.1, gpu: 30 };

/** Whether `load` leaves room to run the browser project beside the rest, and the reading that decided it. */
export const roomToOverlap = ({ cores, busy, gpu }, limits = LIMITS) => {
  const share = busy / cores;
  const reading = `${busy.toFixed(1)} of ${cores} cores busy${gpu === null ? '' : `, GPU ${gpu}%`}`;
  return { ok: share <= limits.busyShare && (gpu === null || gpu <= limits.gpu), reading };
};
