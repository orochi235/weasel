/**
 * Which fleet node a part of a run goes to, from what `onto status` says and what the node itself
 * measures. onto places a job by free cores; a browser test also needs the GPU to itself and nobody
 * at the keyboard, which onto's placement does not weigh. On 2026-11-19 the same 415 browser files
 * took 746 s on an idle teitou and 1,239 s on a teitou someone was using, its GPU 41–67% busy.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LIMITS } from './node-load.mjs';

const run = promisify(execFile);

/** onto's own window (`userIsHere`): a node touched more recently than this has someone at it. */
export const IDLE_WINDOW_S = 600;
const REPO = 'repo:orochi235/weasel';

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Whether `now` falls in a quiet-hours span such as `00:00-09:00`, which may wrap past midnight. */
export const inQuietHours = (span, now = new Date()) => {
  const [from, to] = span.split('-').map(minutesOf);
  const at = now.getHours() * 60 + now.getMinutes();
  return from <= to ? at >= from && at < to : at >= from || at < to;
};

/** The nodes `onto status` lists, each with its free and total cores and whether weasel may run there now. */
export const parseStatus = (text, now = new Date()) => {
  const nodes = new Map();
  for (const line of text.split('\n')) {
    const row = /^(\S+)\s+(\S+)\s+\S+\s+\S+\s+([\d.]+)\/(\d+)\s/.exec(line);
    if (row && row[1] !== 'NAME') {
      nodes.set(row[1], { name: row[1], online: row[2] === 'online', free: Number(row[3]), cores: Number(row[4]), barred: '' });
      continue;
    }
    const note = /^\s+(\S+) (refuses (\S+)|keeps quiet hours (\d\d:\d\d-\d\d:\d\d)|is quiet until (\d\d:\d\d))/.exec(line);
    const node = note && nodes.get(note[1]);
    if (!node) continue;
    if (note[3] && (note[3] === REPO || note[3] === 'rotation')) node.barred = `refuses ${note[3]}`;
    if (note[4] && inQuietHours(note[4], now)) node.barred = `quiet hours ${note[4]}`;
    if (note[5]) node.barred = `quiet until ${note[5]}`;
  }
  return [...nodes.values()];
};

const PROBE = [
  'ioreg -r -d 1 -w 0 -c IOAccelerator | grep -o \'"Device Utilization %"=[0-9]*\' | head -1',
  'ioreg -c IOHIDSystem -d 4 | grep -o \'"HIDIdleTime" = [0-9]*\' | head -1',
].join('; ');

/** A probe's GPU percent and keyboard idle seconds; either is null when the node gave no reading. */
export const parseProbe = (text) => {
  const gpu = /"Device Utilization %"=(\d+)/.exec(text);
  const idle = /"HIDIdleTime" = (\d+)/.exec(text);
  return { gpu: gpu ? Number(gpu[1]) : null, idle: idle ? Math.floor(Number(idle[1]) / 1e9) : null };
};

/** Reads a node's GPU and keyboard idle time, or null when it does not answer in `timeoutMs`. */
const probe = async (name, timeoutMs) => {
  try {
    const { stdout } = await run(
      'onto',
      ['run', '--kind', 'probe', '--about', 'Reads the GPU and keyboard idle time, to place a browser test job.', '--expect', '10s',
        '--dir', '/tmp', name, '--', '/bin/sh', '-c', PROBE],
      { encoding: 'utf8', timeout: timeoutMs },
    );
    return parseProbe(stdout);
  } catch {
    return null;
  }
};

/**
 * Whether a probed node can take browser work: its GPU at most `LIMITS.gpu` busy and nobody at it.
 * A node with no reading for either fails, since an unread GPU may be the busy one.
 */
export const gpuReady = (reading) =>
  Boolean(reading) && reading.gpu !== null && reading.gpu <= LIMITS.gpu && reading.idle !== null && reading.idle >= IDLE_WINDOW_S;

/** The best of `probed` ({ node, reading }) for browser work: an idle GPU first, then the most free cores. */
export const rankForBrowser = (probed) =>
  probed
    .filter(({ reading }) => gpuReady(reading))
    .sort((a, b) => a.reading.gpu - b.reading.gpu || b.node.free - a.node.free)
    .map(({ node, reading }) => ({ ...node, ...reading }));

/** The best of `probed` for the rest of a run: nobody at it, then the most free cores. */
export const rankForRest = (probed) =>
  probed
    .filter(({ reading }) => reading?.idle != null && reading.idle >= IDLE_WINDOW_S)
    .sort((a, b) => b.node.free - a.node.free)
    .map(({ node, reading }) => ({ ...node, ...reading }));

/** The node fleet runs may use now, with none of `avoid` and at least `minFree` cores free. */
export const usableNodes = (nodes, { avoid = [], minFree = 0 } = {}) =>
  nodes.filter((n) => n.online && !n.barred && !avoid.includes(n.name) && n.free >= minFree);

/** `onto status`'s nodes, parsed. */
export const fleetNodes = async () => {
  const { stdout } = await run('onto', ['status', '--probes', '0'], { encoding: 'utf8', timeout: 30_000 });
  return parseStatus(stdout);
};

/**
 * Where a split run's two jobs go, measured now: `browser` on an idle GPU nobody is using, and `rest`
 * on the other unattended node with the most free cores, or undefined to let onto choose. Probes every
 * usable node at once, so the slowest probe sets how long this takes.
 */
export const placeParts = async ({ avoid = [], minFree = 4, timeoutMs = 30_000 } = {}) => {
  const nodes = usableNodes(await fleetNodes(), { avoid, minFree });
  const probed = await Promise.all(nodes.map(async (node) => ({ node, reading: await probe(node.name, timeoutMs) })));
  const [browser] = rankForBrowser(probed);
  const [rest] = browser ? rankForRest(probed.filter(({ node }) => node.name !== browser.name)) : [];
  const readings = probed.map(({ node, reading }) =>
    `${node.name} ${reading ? `GPU ${reading.gpu ?? '?'}%, idle ${reading.idle ?? '?'}s` : 'no answer'}`).join('; ');
  return { browser, rest, readings: readings || 'no usable node' };
};
