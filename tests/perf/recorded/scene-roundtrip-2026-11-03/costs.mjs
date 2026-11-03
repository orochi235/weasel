/**
 * Each per-call cost the PERF entry names, timed alone against the synced tree: the cost a bare
 * scene call paid before 2026-11-03 (`old`) and what it pays now (`now`), each less the same body
 * run bare. Batch medians in ns per call; prints one JSON record. Needs the tree's
 * `EditMode.enter`/`leave` and `PoseWriteLog.label`/`unlabel`.
 */
import { createEditMode } from 'core/scene/editMode';
import { createPoseWriteLog } from 'core/scene/poseWrites';
import { createNotifier } from 'core/scene/notifier';

const BATCH = 1000;
const BATCHES = Number(process.env.BATCHES ?? 200);
const WARM = 50000;

let sink = 0;
const work = (n) => { sink += n; };

function time(body) {
  for (let i = 0; i < WARM; i++) body(i);
  const per = [];
  for (let b = 0; b < BATCHES; b++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < BATCH; i++) body(i);
    per.push(Number(process.hrtime.bigint() - t0) / BATCH);
  }
  per.sort((a, b) => a - b);
  return per[per.length >> 1];
}

const mode = createEditMode();
const notifier = createNotifier();
const log = createPoseWriteLog({ shown: () => undefined, untracked: mode.untracked, changes: notifier });
const bareNotifier = createNotifier();
const raw = { apply: (p) => work(p.id.length), revert: (p) => work(p.id.length) };
let wrapped = raw;
log.reporting((_kind, h) => { wrapped = h; })('kit:setPose', raw);
const payload = { id: 'n1', from: { x: 0 }, to: { x: 1 } };
const op = { name: 'kit:setPose', args: payload, apply: () => undefined, invert: () => op };

const base = time((i) => work(i));
const result = {
  label: process.env.LABEL ?? null,
  baseNs: base,
  own: {
    old: time((i) => mode.during('own', () => work(i))) - base,
    now: time((i) => {
      mode.enter('own');
      try { work(i); } finally { mode.leave('own'); }
    }) - base,
  },
  copy: {
    old: time((i) => { const ops = [op]; work(ops.slice().length + i); }) - time((i) => { const ops = [op]; work(ops.length + i); }),
    now: 0,
  },
  labeled: {
    old: time((i) => log.labeled('setPose', 'call', () => work(i))) - base,
    now: time((i) => {
      const took = log.label('setPose', 'call');
      try { work(i); } finally { if (took) log.unlabel(); }
    }) - base,
  },
  wrappedHandler: time(() => wrapped.apply(payload)) - time(() => raw.apply(payload)),
  flushOnNotify: time(() => notifier.notify()) - time(() => bareNotifier.notify()),
};
if (sink === 0.5) console.error(sink);
console.log(JSON.stringify(result));
