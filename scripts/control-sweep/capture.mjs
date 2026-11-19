/** The sweep's view of a page: settling, capturing, loading a demo, and finding a control in it again. */
import { createHash } from 'node:crypto';
import { sameSteadyState } from './judge.mjs';
import { ROOT, kit, operate } from './operate.mjs';

const LOAD_TIMEOUT_MS = 20_000;
export const STEADY_TRIES = 12;
const STEADY_GAP_MS = 250;
export const RESTLESS_TRIES = 2;
/**
 * labkit's shell, trial title bars and sidebar section bars: the same controls in every lab, swept in
 * the first lab that shows them and skipped after.
 */
const CHROME = '.lk-shell-header,.lk-shell-menubar,.lk-shell-footer,.lk-trial__titlebar,.lk-sidebar-section__bar,.lk-sidebar-section__head';

export const hash = (data) => createHash('sha1').update(data).digest('hex').slice(0, 16);

const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** Two frames and a settle, with the pointer parked off the demo. */
export const settle = async (page, ms) => {
  await page.mouse.move(1, 1);
  await frames(page);
  await page.waitForTimeout(ms);
};

export const capture = async (page, id) => {
  const snap = await kit(page, 'capture', ROOT, id ?? null);
  const canvases = [];
  // A clip shows whatever is on screen there, so a canvas under the control would show its thumb move.
  const mask = id ? [page.locator(`[data-sweep-field="${id}"]`)] : [];
  for (const clip of snap.canvases) canvases.push(hash(await page.screenshot({ clip, mask, caret: 'hide' })));
  return { dom: snap.dom, canvases, names: snap.names };
};

const steady = (a, b) => sameSteadyState(a, a, b);

/** Loads (or reloads) the demo and waits until it holds still, or until it plainly never will. */
export const load = async (page, url, { reload = false, tries = STEADY_TRIES } = {}) => {
  if (reload) await page.reload({ waitUntil: 'load' });
  else await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector(ROOT, { timeout: LOAD_TIMEOUT_MS });
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), ROOT);
  let last = await capture(page);
  for (let i = 0; i < tries; i++) {
    await settle(page, STEADY_GAP_MS);
    const next = await capture(page);
    if (steady(last, next)) return true;
    last = next;
  }
  return false;
};

export const discover = (page) => kit(page, 'discover', ROOT, CHROME);

/** The control's descriptor in the page as it is now, found by its key; menu items through their trigger. */
export const locate = async (page, c) => {
  const controls = await discover(page);
  if (c.kind !== 'menuitem') return controls.find((d) => d.key === c.key);
  const trigger = controls.find((d) => d.key === c.triggerKey);
  return trigger && { ...c, triggerId: trigger.id };
};

/** Puts the page back where `pre` (if any) left it, with `c` found afresh. */
export const prepare = async (page, url, c, settleMs, tries) => {
  if (c.precondition) {
    await load(page, url, { reload: true, tries });
    const pre = await locate(page, c.precondition);
    if (!pre) throw new Error(`the control it depends on, ${c.precondition.label}, is gone`);
    await operate(page, pre);
    await settle(page, settleMs);
  }
  const now = await locate(page, c);
  if (!now) throw new Error('control not found after reload');
  return { ...c, ...now, precondition: c.precondition };
};
