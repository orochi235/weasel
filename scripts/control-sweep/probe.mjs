/**
 * The gesture probe, for a control that changed nothing when operated: many (a tool, a lasso mode, a
 * snap setting) only change what the next drag on the canvas does. It drags across the demo's largest
 * canvas from a fresh load (twice), then from a fresh load with the control operated first, and compares
 * the results.
 */
import { capture, load, prepare, settle } from './capture.mjs';
import { compareCaptures } from './judge.mjs';
import { ROOT, kit, operate } from './operate.mjs';

const DRAG_STEPS = 12;

/** A press at 30%/35% of the canvas, dragged to 65%/70%, and let go. */
const drag = async (page, r) => {
  const at = (fx, fy) => [r.x + r.width * fx, r.y + r.height * fy];
  const [x0, y0] = at(0.3, 0.35);
  const [x1, y1] = at(0.65, 0.7);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: DRAG_STEPS });
  await page.mouse.up();
};

/** After a fresh load and `c`'s precondition, optionally `c` operated, then the drag: what the demo shows. */
const dragFrom = async (page, c, ctx, operated) => {
  await load(page, ctx.url, { reload: true, tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  if (operated) {
    await operate(page, live);
    await settle(page, ctx.settleMs);
  }
  const rect = await kit(page, 'bigCanvas', ROOT);
  if (!rect) return undefined;
  await drag(page, rect);
  await settle(page, ctx.settleMs);
  return capture(page, live.id);
};

/** Whether operating `c` changes what a drag on the canvas does. Undefined when the demo has no canvas to drag on. */
export const probeGesture = async (page, c, ctx) => {
  const plain = await dragFrom(page, c, ctx, false);
  if (!plain) return undefined;
  // A second plain run says what differs from one load to the next (a seed, a clock), which proves nothing.
  const again = await dragFrom(page, c, ctx, false);
  const probed = await dragFrom(page, c, ctx, true);
  if (!again || !probed) return undefined;
  const cmp = compareCaptures(plain, again, probed);
  return cmp.domChanged > 0 || cmp.canvasChanged.length > 0;
};
