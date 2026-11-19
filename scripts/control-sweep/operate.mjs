/**
 * Operating one control in a Playwright page, and putting it back. Each `operate` answers a `restore`
 * that tries to return the control to where it was, or undefined when nothing can (a button).
 */
const ROOT = '.ckd-demo-frame';
const POPUP_WAIT_MS = 1500;
const MAX_PRESSES = 120;

const kit = (page, method, ...args) => page.evaluate(([m, a]) => window.__sweep[m](...a), [method, args]);
const sel = (id) => `[data-sweep-id="${id}"]`;

const click = async (page, id) => {
  const hit = await kit(page, 'markHit', id);
  if (!hit) throw new Error('control is gone');
  await page.locator(hit).first().click({ timeout: 3000 });
};

const focus = (page, id) => page.locator(sel(id)).first().focus({ timeout: 3000 });

const sliderValue = async (page, id) => Number((await kit(page, 'state', id))?.value);

/** Presses arrows (and pages, while far off) until the slider reads `target`, or gives up. */
const walkSlider = async (page, id, target) => {
  await focus(page, id);
  for (let i = 0; i < MAX_PRESSES; i++) {
    const s = await kit(page, 'state', id);
    const v = Number(s?.value);
    if (!Number.isFinite(v) || v === target) return;
    const span = Number.isFinite(s.max - s.min) ? s.max - s.min : 0;
    const far = span > 0 && Math.abs(v - target) > span / 8;
    const up = v < target;
    await page.keyboard.press(far ? (up ? 'PageUp' : 'PageDown') : (up ? 'ArrowRight' : 'ArrowLeft'));
  }
};

const operateSlider = async (page, c) => {
  const s = await kit(page, 'state', c.id);
  const start = Number(s?.value);
  await focus(page, c.id);
  const atMax = Number.isFinite(s?.max) && start >= s.max;
  // `nudge` moves one step, for a setting whose extreme happens to look like its start (an offset of a full turn).
  if (c.nudge) await page.keyboard.press(atMax ? 'ArrowLeft' : 'ArrowRight');
  else {
    await page.keyboard.press(atMax ? 'Home' : 'End');
    if (await sliderValue(page, c.id) === start) await page.keyboard.press('Home');
  }
  return Number.isFinite(start) ? () => walkSlider(page, c.id, start) : undefined;
};

/** The field's number bumped by one, keeping whatever unit text follows it. */
export const bumped = (value) => {
  const m = /^(\s*-?\d*\.?\d+)(.*)$/s.exec(value);
  return m ? `${Number(m[1]) + 1}${m[2]}` : '1';
};

const commitText = async (page, id, value) => {
  const field = page.locator(sel(id)).first();
  await field.fill(value, { timeout: 3000 });
  await field.press('Enter');
  await page.evaluate((s) => document.querySelector(s)?.blur(), sel(id));
};

const operateNumber = async (page, c) => {
  const start = (await kit(page, 'state', c.id))?.value ?? '';
  await focus(page, c.id);
  await page.keyboard.press('ArrowUp');
  if ((await kit(page, 'state', c.id))?.value === start) await page.keyboard.press('ArrowDown');
  if ((await kit(page, 'state', c.id))?.value === start) await commitText(page, c.id, bumped(start));
  else await page.evaluate((s) => document.querySelector(s)?.blur(), sel(c.id));
  return () => commitText(page, c.id, start);
};

const operateColor = async (page, c) => {
  const start = (await kit(page, 'state', c.id))?.value ?? '#000000';
  const next = start.toLowerCase() === '#e0115f' ? '#1fbf5f' : '#e0115f';
  await page.locator(sel(c.id)).first().fill(next, { timeout: 3000 });
  return () => page.locator(sel(c.id)).first().fill(start, { timeout: 3000 });
};

const operateNativeSelect = async (page, c) => {
  const s = await kit(page, 'state', c.id);
  const next = s?.options?.find((v) => v !== s.value);
  if (next === undefined) throw new Error('select has no other option');
  await page.locator(sel(c.id)).first().selectOption(next, { timeout: 3000 });
  return () => page.locator(sel(c.id)).first().selectOption(s.value, { timeout: 3000 });
};

/** Opens a popup trigger and answers the popup's items, stamped. */
export const openPopup = async (page, id, kind) => {
  await click(page, id);
  const deadline = Date.now() + POPUP_WAIT_MS;
  for (;;) {
    const items = await kit(page, 'popupItems', kind);
    if (items.length > 0 || Date.now() > deadline) return items;
    await page.waitForTimeout(50);
  }
};

const closePopup = (page) => page.keyboard.press('Escape');

const choose = async (page, items, pick) => {
  const item = items.find(pick);
  if (!item) {
    await closePopup(page);
    return false;
  }
  await page.locator(sel(item.id)).first().click({ timeout: 3000 });
  return true;
};

const operateListSelect = async (page, c) => {
  const items = await openPopup(page, c.id, 'listbox');
  const was = items.find((i) => i.selected)?.label;
  if (!await choose(page, items, (i) => !i.selected && !i.disabled)) throw new Error('select has no other option');
  if (was === undefined) return undefined;
  return async () => {
    const again = await openPopup(page, c.id, 'listbox');
    await choose(page, again, (i) => i.label === was);
  };
};

const operateMenuItem = async (page, c) => {
  const items = await openPopup(page, c.triggerId, 'menu');
  if (!await choose(page, items, (i) => i.label === c.item && !i.disabled)) throw new Error(`menu has no item "${c.item}"`);
  return undefined;
};

const operateClick = async (page, c) => {
  await click(page, c.id);
  if (c.kind === 'checkbox' || c.kind === 'switch' || c.kind === 'toggle') return () => click(page, c.id);
  if ((c.kind === 'radio' || c.kind === 'tab') && c.restoreTo) return () => click(page, c.restoreTo);
  return undefined;
};

/** Operates control `c` once. Answers a function that puts it back, or undefined. */
export const operate = (page, c) => {
  switch (c.kind) {
    case 'slider': return operateSlider(page, c);
    case 'number': return operateNumber(page, c);
    case 'color': return operateColor(page, c);
    case 'select': return c.native ? operateNativeSelect(page, c) : operateListSelect(page, c);
    case 'menuitem': return operateMenuItem(page, c);
    default: return operateClick(page, c);
  }
};

/** The items of menu `c`, each a control of its own; the menu is closed again. */
export const menuItemsOf = async (page, c) => {
  const items = await openPopup(page, c.id, 'menu');
  await closePopup(page);
  return items.map((i) => ({
    kind: 'menuitem', triggerId: c.id, triggerKey: c.key, item: i.label, name: i.label, chrome: c.chrome,
    key: `menuitem:${c.label} › ${i.label}`, label: `${c.label} › ${i.label}`,
    ...(i.disabled ? { skip: 'disabled' } : i.submenu ? { skip: 'opens a submenu' } : {}),
  }));
};

export { ROOT, kit };
