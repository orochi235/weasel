/**
 * The gesture probe, for a control that changed nothing when operated. Many only act through the
 * canvas: a tool, a lasso mode or a lock changes what the next drag does, and a reset or a delete acts
 * only once a drag has moved or selected something. So the probe drags across the demo's largest canvas
 * from fresh loads three ways (plain, control first, control after) and compares what each leaves.
 */
import { capture, discover, load, prepare, settle } from './capture.mjs';
import { animationFlips, compareCaptures } from './judge.mjs';
import { ROOT, kit, operate } from './operate.mjs';

const DRAG_STEPS = 12;

/** A press at 30%/35% of the canvas, dragged to 65%/70%, and let go; then a wheel turn at its center, which a view zooms on. */
const drag = async (page, r) => {
  const at = (fx, fy) => [r.x + r.width * fx, r.y + r.height * fy];
  const [x0, y0] = at(0.3, 0.35);
  const [x1, y1] = at(0.65, 0.7);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: DRAG_STEPS });
  await page.mouse.up();
  await page.mouse.move(...at(0.5, 0.5));
  await page.mouse.wheel(0, -240);
};

/**
 * A fresh load and `c`'s precondition, `tool` chosen if given, then the drag with `c` operated `when`
 * ('before', 'after' or never): what the demo shows.
 */
const dragRun = async (page, c, ctx, when, tool) => {
  await load(page, ctx.url, { tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  if (tool) {
    const t = (await discover(page)).find((d) => d.key === tool.key);
    if (!t) return undefined;
    await operate(page, t);
  }
  const act = async () => {
    await operate(page, { ...c, ...(await prepare(page, ctx.url, { ...c, precondition: undefined }, ctx.settleMs, ctx.tries)) });
    await settle(page, ctx.settleMs);
  };
  // Every run waits the same in each slot, so what time alone changes (a fade, inertia) reads the same.
  if (when === 'before') await act();
  else await settle(page, ctx.settleMs);
  const rect = await kit(page, 'bigCanvas', ROOT);
  if (!rect) return undefined;
  await drag(page, rect);
  await settle(page, ctx.settleMs);
  if (when === 'after') await act();
  else await settle(page, ctx.settleMs);
  return capture(page, live.id);
};

const differs = (cmp) => cmp.domChanged > 0 || cmp.canvasChanged.length > 0;

const TOOLS_TRIED = 4;

/** Whether `c` operated `when` changes what a drag with `tool` (or the tool already chosen) does or leaves. */
const differsUnder = async (page, c, ctx, when, tool) => {
  const plain = await dragRun(page, c, ctx, undefined, tool);
  // A second plain run says what differs from one load to the next (a seed, a clock), which proves nothing.
  const again = plain && await dragRun(page, c, ctx, undefined, tool);
  const probed = again && await dragRun(page, c, ctx, when, tool);
  return Boolean(probed && differs(compareCaptures(plain, again, probed)));
};

/**
 * Whether operating `c` changes what a drag on the canvas does, or what a drag left behind: 'before',
 * 'after', or undefined for neither (and when the demo has no canvas to drag on). A setting is tried
 * with each of the palette's tools too, since a tool's own setting shows only in that tool's drag.
 */
export const probeGesture = async (page, c, ctx) => {
  if (!await kit(page, 'bigCanvas', ROOT)) return undefined;
  // A setting changes what the next drag does; only an action (a button, a menu item) can act on what a drag left.
  const action = c.kind === 'button' || c.kind === 'menuitem';
  for (const when of action ? ['before', 'after'] : ['before']) {
    if (await differsUnder(page, c, ctx, when, undefined)) return when;
  }
  if (action || c.tool) return undefined;
  const tools = (await discover(page)).filter((d) => d.tool && !d.selected && !d.skip).slice(0, TOOLS_TRIED);
  for (const tool of tools) {
    if (await differsUnder(page, c, ctx, 'before', tool)) return `before:${tool.label}`;
  }
  return undefined;
};

const BUTTONS_TRIED = 5;

/** A fresh load and `c`'s precondition, `c` operated if `operated`, then `button` pressed: two captures a settle apart. */
const pressRun = async (page, c, button, ctx, operated) => {
  await load(page, ctx.url, { tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  if (operated) await operate(page, live);
  await settle(page, ctx.settleMs);
  const target = (await discover(page)).find((d) => d.key === button.key);
  if (!target) return undefined;
  await operate(page, target);
  await settle(page, ctx.settleMs);
  const first = await capture(page, live.id);
  await settle(page, ctx.settleMs);
  return { first, second: await capture(page, live.id) };
};

/**
 * Whether operating setting `c` changes what one of the demo's buttons then does: a fit mode only a Fit
 * button reads, a key only the Push buttons use. Answers that button's label, or undefined.
 */
export const probeButtons = async (page, c, ctx) => {
  if (c.kind === 'button' || c.kind === 'menuitem') return undefined;
  const buttons = (await discover(page)).filter((d) => (d.kind === 'button' || d.kind === 'toggle') && !d.skip && !d.chrome && !d.tool && d.key !== c.key).slice(0, BUTTONS_TRIED);
  for (const b of buttons) {
    const plain = await pressRun(page, c, b, ctx, false);
    const probed = plain && await pressRun(page, c, b, ctx, true);
    if (!probed) continue;
    // A pause shows as an animation the button starts that, after the setting, holds still.
    if (differs(compareCaptures(plain.first, plain.second, probed.second))
      || animationFlips(plain.first, plain.second, probed.first, probed.second).length > 0) return b.label;
  }
  return undefined;
};
