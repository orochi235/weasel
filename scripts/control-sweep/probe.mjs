/**
 * The gesture probe, for a control that changed nothing when operated. Many only act through the
 * canvas: a tool, a lasso mode or a lock changes what the next drag does, and a reset or a delete acts
 * only once a drag has moved or selected something. So the probe drags across the demo's largest canvas
 * from fresh loads three ways (plain, control first, control after) and compares what each leaves.
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

/** A fresh load and `c`'s precondition, then the drag with `c` operated `when` ('before', 'after' or never): what the demo shows. */
const dragRun = async (page, c, ctx, when) => {
  await load(page, ctx.url, { reload: true, tries: ctx.tries });
  const live = await prepare(page, ctx.url, c, ctx.settleMs, ctx.tries);
  const act = async () => {
    await operate(page, { ...c, ...(await prepare(page, ctx.url, { ...c, precondition: undefined }, ctx.settleMs, ctx.tries)) });
    await settle(page, ctx.settleMs);
  };
  if (when === 'before') await act();
  const rect = await kit(page, 'bigCanvas', ROOT);
  if (!rect) return undefined;
  await drag(page, rect);
  await settle(page, ctx.settleMs);
  if (when === 'after') await act();
  return capture(page, live.id);
};

const differs = (cmp) => cmp.domChanged > 0 || cmp.canvasChanged.length > 0;

/**
 * Whether operating `c` changes what a drag on the canvas does, or what a drag left behind: 'before',
 * 'after', or undefined for neither (and when the demo has no canvas to drag on).
 */
export const probeGesture = async (page, c, ctx) => {
  const plain = await dragRun(page, c, ctx, undefined);
  if (!plain) return undefined;
  // A second plain run says what differs from one load to the next (a seed, a clock), which proves nothing.
  const again = await dragRun(page, c, ctx, undefined);
  for (const when of ['before', 'after']) {
    const probed = await dragRun(page, c, ctx, when);
    if (probed && differs(compareCaptures(plain, again, probed))) return when;
  }
  return undefined;
};
