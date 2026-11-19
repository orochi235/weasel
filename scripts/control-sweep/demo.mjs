/**
 * One demo through the sweep: load it, find its controls, and for each one capture, operate, capture
 * and put back. A control another control reveals is tried again with that control operated first.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareCaptures, fingerprintOf, sameSteadyState, slug, verdictOf } from './judge.mjs';
import { ROOT, kit, menuItemsOf, operate } from './operate.mjs';

const LOAD_TIMEOUT_MS = 20_000;
const STEADY_TRIES = 12;
const STEADY_GAP_MS = 250;

export const hash = (data) => createHash('sha1').update(data).digest('hex').slice(0, 16);

const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** Two frames and a settle, with the pointer parked off the demo. */
const settle = async (page, ms) => {
  await page.mouse.move(1, 1);
  await frames(page);
  await page.waitForTimeout(ms);
};

const capture = async (page, id) => {
  const snap = await kit(page, 'capture', ROOT, id ?? null);
  const canvases = [];
  for (const clip of snap.canvases) canvases.push(hash(await page.screenshot({ clip, animations: 'disabled', caret: 'hide' })));
  return { dom: snap.dom, canvases };
};

const steady = (a, b) => sameSteadyState(a, a, b);

/** Loads (or reloads) the demo and waits until it holds still, or until it plainly never will. */
export const load = async (page, url, { reload = false } = {}) => {
  if (reload) await page.reload({ waitUntil: 'load' });
  else await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector(ROOT, { timeout: LOAD_TIMEOUT_MS });
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), ROOT);
  let last = await capture(page);
  for (let i = 0; i < STEADY_TRIES; i++) {
    await settle(page, STEADY_GAP_MS);
    const next = await capture(page);
    if (steady(last, next)) return true;
    last = next;
  }
  return false;
};

const discover = (page) => kit(page, 'discover', ROOT);

/** The control's descriptor in the page as it is now, found by its key; menu items through their trigger. */
const locate = async (page, c) => {
  const controls = await discover(page);
  if (c.kind !== 'menuitem') return controls.find((d) => d.key === c.key);
  const trigger = controls.find((d) => d.key === c.triggerKey);
  return trigger && { ...c, triggerId: trigger.id };
};

const frameShot = (page) => page.locator(ROOT).first().screenshot({ animations: 'disabled', caret: 'hide' });

/** Captures before, operates, captures after. Answers the comparison, what the page did, and the restore. */
const attempt = async (page, c, { settleMs, events, shots }) => {
  const before0 = await capture(page, c.id);
  await settle(page, settleMs);
  const before1 = await capture(page, c.id);
  const shotBefore = shots ? await frameShot(page) : undefined;
  const url = page.url();
  events.reset();
  const t0 = Date.now();
  const restore = await operate(page, c);
  const operateMs = Date.now() - t0;
  await settle(page, settleMs);
  const after = await capture(page, c.id);
  const shotAfter = shots ? await frameShot(page) : undefined;
  const left = events.what() ?? (page.url() !== url ? 'leaves the page' : undefined);
  return { before0, before1, after, restore, left, operateMs, shotBefore, shotAfter };
};

/** Puts the page back where `pre` (if any) left it, with `c` found afresh. */
const prepare = async (page, url, c, settleMs) => {
  if (c.precondition) {
    await load(page, url, { reload: true });
    const pre = await locate(page, c.precondition);
    if (!pre) throw new Error(`the control it depends on, ${c.precondition.label}, is gone`);
    await operate(page, pre);
    await settle(page, settleMs);
  }
  const now = await locate(page, c);
  if (!now) throw new Error('control not found after reload');
  return { ...c, ...now, precondition: c.precondition };
};

const record = (demo, c, fields) => ({
  demo: demo.id, path: demo.path, key: c.key, label: c.label, kind: c.kind,
  ...(c.precondition ? { precondition: c.precondition.label } : {}), ...fields,
});

/** Tries control `c`. Answers its record, whether the page must be reloaded, and any controls it revealed. */
const trial = async (page, demo, c, ctx) => {
  const t0 = Date.now();
  const live = await prepare(page, ctx.url, c, ctx.settleMs);
  const keysBefore = new Set((await discover(page)).map((d) => d.key));
  const a = await attempt(page, live, { ...ctx, shots: false });
  if (a.left) return { rec: record(demo, c, { verdict: 'skipped', reason: a.left, ms: Date.now() - t0 }), reload: true, revealed: [] };
  const cmp = compareCaptures(a.before0, a.before1, a.after);
  let { verdict, reason } = verdictOf(cmp);
  const revealed = c.precondition || c.kind === 'menuitem' ? []
    : (await discover(page)).filter((d) => !keysBefore.has(d.key) && d.id !== live.id && !d.skip).map((d) => ({ ...d, precondition: { key: c.key, label: c.label, kind: c.kind, triggerKey: c.triggerKey, item: c.item } }));
  let reload = Boolean(c.precondition) || (!a.restore && verdict !== 'dead');
  if (!reload && a.restore && verdict !== 'dead') {
    await a.restore();
    await settle(page, ctx.settleMs);
    reload = !sameSteadyState(a.before0, a.before1, await capture(page, live.id));
  }
  let shots;
  if (verdict === 'dead') {
    ({ verdict, reason, shots } = await confirm(page, demo, c, ctx));
    reload = true;
  }
  const fp = (x) => fingerprintOf(x, hash);
  return {
    rec: record(demo, c, {
      verdict, ...(reason ? { reason } : {}), compared: cmp,
      fingerprints: { before: fp(a.before1), after: fp(a.after) },
      ms: Date.now() - t0, operateMs: a.operateMs, ...(shots ? { shots } : {}),
    }),
    reload, revealed,
  };
};

/** A control judged dead is tried once more from a fresh load, with screenshots; dead twice is dead. */
const confirm = async (page, demo, c, ctx) => {
  await load(page, ctx.url, { reload: true });
  const live = await prepare(page, ctx.url, c, ctx.settleMs);
  const a = await attempt(page, live, { ...ctx, shots: true });
  const { verdict } = verdictOf(compareCaptures(a.before0, a.before1, a.after));
  if (verdict !== 'dead') return { verdict: 'unsure', reason: `dead once, ${verdict} on the retry` };
  const base = `${demo.id}--${slug(c.label)}`;
  const shots = [`${base}-before.png`, `${base}-after.png`];
  writeFileSync(join(ctx.shotsDir, shots[0]), a.shotBefore);
  writeFileSync(join(ctx.shotsDir, shots[1]), a.shotAfter);
  return { verdict: 'dead', shots: shots.map((s) => `shots/${s}`) };
};

/**
 * Sweeps one demo. `ctx`: `{ base, settleMs, events, shotsDir, onRecord }`. Answers its records and
 * whether it loaded.
 */
export const sweepDemo = async (page, demo, ctx) => {
  const url = `${ctx.base}#${demo.id}`;
  const t0 = Date.now();
  const steadyLoad = await load(page, url);
  const found = await discover(page);
  const queue = [];
  for (const c of found) {
    if (c.kind === 'menu' && !c.skip) {
      queue.push(...await menuItemsOf(page, c));
      continue;
    }
    queue.push(c);
  }
  const records = [];
  const tried = new Set();
  const full = { ...ctx, url };
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const id = `${c.precondition ? 'revealed' : 'shown'}\u0000${c.key}`;
    if (tried.has(id)) continue;
    tried.add(id);
    let out;
    if (c.skip) out = { rec: record(demo, c, { verdict: 'skipped', reason: c.skip }), reload: false, revealed: [] };
    else {
      try {
        out = await trial(page, demo, c, full);
      } catch (error) {
        out = { rec: record(demo, c, { verdict: 'error', reason: String(error.message ?? error).split('\n')[0] }), reload: true, revealed: [] };
      }
    }
    records.push(out.rec);
    ctx.onRecord(out.rec);
    queue.push(...out.revealed);
    if (out.reload) await load(page, url, { reload: true });
  }
  return { records, steadyLoad, ms: Date.now() - t0 };
};
