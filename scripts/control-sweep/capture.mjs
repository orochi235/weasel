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

/** Undo and Redo light up after any edit, a dead one included, so captures leave them out. */
const HISTORY = '[aria-label=Undo],[aria-label=Redo]';

export const hash = (data) => createHash('sha1').update(data).digest('hex').slice(0, 16);

const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** Two frames and a settle, with the pointer parked off the demo. */
export const settle = async (page, ms) => {
  await page.mouse.move(1, 1);
  await frames(page);
  await page.waitForTimeout(ms);
};

/** A clip of the screen, hashed; a clip the browser refuses (it fell off the page) reads the same every time. */
const clipHash = async (page, clip, mask) => {
  try {
    return hash(await page.screenshot({ clip, mask, caret: 'hide' }));
  } catch {
    return 'unreadable';
  }
};

export const capture = async (page, id) => {
  const snap = await kit(page, 'capture', ROOT, id ?? null, HISTORY);
  const canvases = [];
  // A 2D canvas comes back as its own pixels. Any other is a clip of the screen, which shows whatever is
  // there, so a canvas under the control would show its thumb move unless the field is masked.
  const mask = [page.locator(HISTORY), ...(id ? [page.locator(`[data-sweep-field="${id}"]`)] : [])];
  for (const c of snap.canvases) canvases.push(c.pixels ?? await clipHash(page, c, mask));
  return { dom: snap.dom, canvases, names: snap.names };
};

const steady = (a, b) => sameSteadyState(a, a, b);

/** Loads the demo afresh, with its origin's storage cleared, and waits until it holds still, or until it plainly never will. */
export const load = async (page, url, { tries = STEADY_TRIES } = {}) => {
  // A lab keeps its settings in IndexedDB, so a plain reload brings back what the last control changed. Leave
  // the page first, so nothing holds the database open, and clear the origin's storage.
  await page.goto('about:blank');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'all' });
  } finally {
    await cdp.detach();
  }
  // Not 'load': a demo still fetching something (a font, a worker) holds that back, and the frame is what counts.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
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

const FIND_WAIT_MS = 2000;

/** `locate`, asked again for a while: what a control reveals can arrive a few frames after it. */
const locateSoon = async (page, c) => {
  const deadline = Date.now() + FIND_WAIT_MS;
  for (;;) {
    const found = await locate(page, c);
    if (found || Date.now() > deadline) return found;
    await page.waitForTimeout(100);
  }
};

/** The keys on the page now that share `c`'s name, for an error that says what was there instead. */
const nearMisses = async (page, c) => {
  const name = (c.name ?? c.label).toLowerCase();
  const all = (await discover(page)).map((d) => d.key);
  const keys = all.filter((k) => k.toLowerCase().includes(name));
  return keys.length ? `; the page has ${keys.slice(0, 4).join(', ')}` : `; the page has ${all.length} controls, none named for it`;
};

const PRECONDITION_TRIES = 3;

/** Operates the control `c` depends on, closing any popup that opens with it. */
const applyPrecondition = async (page, c, settleMs) => {
  const pre = await locateSoon(page, c.precondition);
  if (!pre) throw new Error(`the control it depends on, ${c.precondition.label}, is gone${await nearMisses(page, c.precondition)}`);
  await operate(page, pre);
  await settle(page, settleMs);
  // A precondition that opens a popup (a chip's paint editor) hides the demo behind it; only its choice is wanted.
  if ((await kit(page, 'capture', ROOT, null)).dom.popups !== '0') {
    await page.keyboard.press('Escape');
    await settle(page, settleMs);
  }
};

/**
 * Puts the page back where `c`'s precondition (if any) left it, with `c` found afresh. A lab that restores its
 * state late (from storage, after it first draws) can undo a precondition pressed while it was still loading,
 * so a control that has not shown is given its precondition again, in the page as it now stands.
 */
export const prepare = async (page, url, c, settleMs, tries) => {
  if (c.precondition) await load(page, url, { tries });
  for (let attempt = 1; ; attempt++) {
    if (c.precondition) await applyPrecondition(page, c, settleMs);
    const now = await locateSoon(page, c);
    if (now) return { ...c, ...now, precondition: c.precondition };
    if (!c.precondition || attempt === PRECONDITION_TRIES) {
      const pre = c.precondition && await locate(page, c.precondition);
      const after = pre ? `; ${c.precondition.label} is ${pre.selected ? 'chosen' : 'not chosen'}` : '';
      throw new Error(`control not found after reload${after}${await nearMisses(page, c)}`);
    }
  }
};

/** `c` from a fresh load: `prepare` loads afresh itself when `c` has a precondition, so only one without is loaded first. */
export const prepareFresh = async (page, url, c, settleMs, tries) => {
  if (!c.precondition) await load(page, url, { tries });
  return prepare(page, url, c, settleMs, tries);
};
