/**
 * One demo through the sweep: load it, find its controls, and for each one capture, operate, capture
 * and put back. A control another control reveals is tried again with that control operated first.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESTLESS_TRIES, STEADY_TRIES, capture, discover, hash, load, prepare, settle } from './capture.mjs';
import { animationFlips, compareCaptures, fingerprintOf, sameSteadyState, slug, verdictOf } from './judge.mjs';
import { ROOT, kit, menuItemsOf, operate } from './operate.mjs';
import { probeButtons, probeGesture } from './probe.mjs';

/** The demo's box as a JPEG: evidence for a person, so small beats exact. */
const SLOW_SETTLE_MS = 1000;

const frameShot = async (page) => {
  const clip = await page.locator('.ckd-canvas-wrap').first().boundingBox();
  return page.screenshot({ ...(clip ? { clip } : {}), type: 'jpeg', quality: 70, animations: 'disabled', caret: 'hide' });
};

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

/**
 * Whether a control that showed up after operating another is a new one to try under it: not the
 * operated control under a new label, not disabled, not already the chosen one, and not another copy of a control already there
 * (a second trial's, an undocked panel's), which is the same control again.
 */
const isNewControl = (d, keysBefore, operatedId) =>
  d.id !== operatedId && !d.skip && !d.selected && !keysBefore.has(d.key) && !keysBefore.has(`${d.kind}:${d.name}`);

const record = (demo, c, fields) => ({
  demo: demo.id, path: demo.path, key: c.key, label: c.label, kind: c.kind,
  ...(c.precondition ? { precondition: c.precondition.label } : {}), ...fields,
});

/** Tries control `c`. Answers its record, whether the page must be reloaded, and any controls it revealed. */
const trial = async (page, demo, c, ctx) => {
  const t0 = Date.now();
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  const keysBefore = new Set((await discover(page)).flatMap((d) => [d.key, `${d.kind}:${d.name}`]));
  const a = await attempt(page, live, { ...ctx, shots: false });
  if (a.left) return { rec: record(demo, c, { verdict: 'skipped', reason: a.left, ms: Date.now() - t0 }), reload: true, revealed: [] };
  const cmp = compareCaptures(a.before0, a.before1, a.after);
  let { verdict, reason } = verdictOf(cmp);
  const domChanges = cmp.domPaths.length ? await kit(page, 'describePaths', ROOT, cmp.domPaths.filter((p) => p !== 'popups')) : [];
  if (verdict === 'unsure') {
    await settle(page, ctx.settleMs);
    const flips = animationFlips(a.before0, a.before1, a.after, await capture(page, live.id));
    if (flips.length > 0) ({ verdict, reason } = { verdict: 'alive', reason: `starts or stops canvas ${flips.join(', ')} animating` });
  }
  const revealed = c.precondition || c.kind === 'menuitem' ? []
    : (await discover(page)).filter((d) => isNewControl(d, keysBefore, live.id)).map((d) => ({ ...d, precondition: { key: c.key, label: c.label, kind: c.kind, triggerKey: c.triggerKey, item: c.item } }));
  let reload = Boolean(c.precondition) || (!a.restore && verdict !== 'dead');
  if (!reload && a.restore && verdict !== 'dead') {
    try {
      await a.restore();
      await settle(page, ctx.settleMs);
      reload = !sameSteadyState(a.before0, a.before1, await capture(page, live.id));
    } catch {
      // The control re-rendered out from under its restore; a fresh load puts it back instead.
      reload = true;
    }
  }
  let shots;
  if (verdict === 'dead') {
    ({ verdict, reason, shots } = await confirm(page, demo, c, ctx));
    reload = true;
  }
  const fp = (x) => fingerprintOf(x, hash);
  return {
    rec: record(demo, c, {
      verdict, ...(reason ? { reason } : {}), compared: cmp, ...(domChanges.length ? { domChanges } : {}),
      fingerprints: { before: fp(a.before1), after: fp(a.after) },
      ms: Date.now() - t0, operateMs: a.operateMs, ...(shots ? { shots } : {}),
    }),
    reload, revealed,
  };
};

/** Whether moving a slider one step, rather than to its far end, changes anything. */
const nudged = async (page, c, ctx) => {
  await load(page, ctx.url, { tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  const a = await attempt(page, { ...live, nudge: true }, { ...ctx, shots: false });
  return verdictOf(compareCaptures(a.before0, a.before1, a.after)).verdict === 'alive';
};

/** Whether a key shortcut the control declares (`aria-keyshortcuts`, as a drag handle's Alt+Arrow) changes anything. */
const viaShortcut = async (page, c, ctx) => {
  for (const key of c.shortcuts ?? []) {
    await load(page, ctx.url, { tries: ctx.tries });
    const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
    const before0 = await capture(page, live.id);
    await settle(page, ctx.settleMs);
    const before1 = await capture(page, live.id);
    await page.locator(`[data-sweep-id="${live.id}"]`).first().focus({ timeout: 3000 });
    await page.keyboard.press(key);
    await settle(page, ctx.settleMs);
    if (verdictOf(compareCaptures(before0, before1, await capture(page, live.id))).verdict === 'alive') return true;
  }
  return false;
};

/**
 * A control judged dead is tried once more from a fresh load, with screenshots, and then by the gesture
 * probe (and through its key shortcut, if it declares one). Dead to all of them is dead.
 */
const confirm = async (page, demo, c, ctx) => {
  await load(page, ctx.url, { tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  // The retry waits longer: an effect that runs through a promise (an export, a texture) lands late.
  const a = await attempt(page, live, { ...ctx, settleMs: Math.max(ctx.settleMs * 6, SLOW_SETTLE_MS), shots: true });
  const { verdict } = verdictOf(compareCaptures(a.before0, a.before1, a.after));
  if (verdict === 'alive') return { verdict, reason: 'changes something, given a longer wait' };
  if (verdict !== 'dead') return { verdict, reason: `dead once, ${verdict} on the slower retry` };
  if (c.kind === 'slider' && await nudged(page, c, ctx)) return { verdict: 'alive', reason: 'one step changes it; its far end looks like its start' };
  if (await viaShortcut(page, c, ctx)) return { verdict: 'alive', reason: 'acts through its key shortcut' };
  const probed = await probeGesture(page, c, ctx);
  if (probed) {
    const tool = probed.startsWith('before:') ? ` with the ${probed.slice(7)} tool` : '';
    return { verdict: 'alive', reason: probed === 'after' ? 'acts on what a drag on the canvas left' : `changes what a drag on the canvas does${tool}` };
  }
  const via = await probeButtons(page, c, ctx);
  if (via) return { verdict: 'alive', reason: `changes what "${via}" does` };
  const base = `${demo.id}--${slug(c.label)}`;
  const shots = [`${base}-before.jpg`, `${base}-after.jpg`];
  writeFileSync(join(ctx.shotsDir, shots[0]), a.shotBefore);
  writeFileSync(join(ctx.shotsDir, shots[1]), a.shotAfter);
  return { verdict: 'dead', shots: shots.map((s) => `shots/${s}`) };
};

/**
 * Sweeps one demo. `ctx`: `{ base, settleMs, demoMs, events, shotsDir, onRecord, chrome }`, `chrome` mapping
 * each kit-chrome control's key to the demo that swept it. Answers its records and
 * whether it loaded.
 */
export const sweepDemo = async (page, demo, ctx) => {
  const url = `${ctx.base}#${demo.id}`;
  const t0 = Date.now();
  const steadyLoad = await load(page, url);
  const found = await discover(page);
  const queue = [];
  const byId = new Map(found.map((d) => [d.id, d]));
  for (const c of found) {
    if (c.selected && !c.skip) {
      const other = byId.get(c.alternate);
      queue.push(other ? { ...c, precondition: { key: other.key, label: other.label, kind: other.kind } } : { ...c, skip: 'already chosen, with nothing else to choose first' });
      continue;
    }
    if (c.kind === 'menu' && !c.skip) {
      queue.push(...await menuItemsOf(page, c));
      continue;
    }
    queue.push(c);
  }
  const records = [];
  const tried = new Set();
  // A demo that never held still on its first load will not on a reload either; don't wait it out each time.
  const full = { ...ctx, url, tries: steadyLoad ? STEADY_TRIES : RESTLESS_TRIES };
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const id = `${c.precondition ? 'revealed' : 'shown'}\u0000${c.key}`;
    if (tried.has(id)) continue;
    tried.add(id);
    let out;
    const chromeBy = c.chrome && !c.precondition ? ctx.chrome.get(c.key) : undefined;
    if (c.chrome && !c.precondition && !chromeBy) ctx.chrome.set(c.key, demo.id);
    if (chromeBy) out = { rec: record(demo, c, { verdict: 'skipped', reason: `kit chrome, swept in ${chromeBy}` }), reload: false, revealed: [] };
    else if (Date.now() - t0 > ctx.demoMs) out = { rec: record(demo, c, { verdict: 'skipped', reason: `the demo ran past its ${ctx.demoMs / 60000} min` }), reload: false, revealed: [] };
    else if (c.skip) out = { rec: record(demo, c, { verdict: 'skipped', reason: c.skip }), reload: false, revealed: [] };
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
    if (out.reload) await load(page, url, { tries: full.tries });
  }
  return { records, steadyLoad, ms: Date.now() - t0 };
};
