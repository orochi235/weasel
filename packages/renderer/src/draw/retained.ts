import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { compositeProgramId } from '../effects/composite';
import { isOwnComposite, readsBackdrop } from '../effects/compositeOp';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import type { RetainedClip, RetainedKey } from '../retain/retainedKey';
import { boxWithin, contentBox } from '../retain/contentBounds';
import { boxTree, cullToTile } from '../retain/tileCull';
import { movesWithView } from '../retain/movesWithView';
import type { RetainedDraw, RetainedPixels } from '../retain/RetainedSurfaces';
import type { DrawContext } from './drawContext';
import { compositeOver, windowProjection } from './effects';
import type { GpuTarget } from '../gpu/types';
import { enterGroupClip } from './clip';
import { flushBatch } from './flushBatch';

type Dispatch = (ctx: DrawContext, cmd: DrawCommand) => void;

const COMPOSITE_AS_DRAWN = { alpha: 1, colorMatrix: IDENTITY_COLOR_MATRIX };

/** The scratch buffer as a render target: retained draws share it, so one
 *  cannot be drawn inside another. */
const scratchTargets = new WeakSet<object>();

/**
 * Draw a group carrying `retain` from the pixels it left last time, drawing
 * them again first if anything they were drawn under has moved. `false` when
 * no surface can stand in for it here, and the caller draws it as an ordinary
 * group.
 *
 * Inside, the group draws under everything it would on the canvas — the
 * transform, alpha and color matrix of the stack above it, and every clip
 * enclosing it — into a cleared multisampled buffer, so source-over makes
 * compositing the result the same as drawing it in place. The clips go inside
 * rather than on the composite because an edge of a clip and an edge of the
 * content crossing one pixel cover its samples together: clip the resolved
 * pixel instead and that pixel comes out as much as 30 levels off.
 *
 * The surface covers only the device pixels the group can paint
 * (`contentBounds`), drawn under the canvas's own projection moved to each
 * tile's corner, and composited as a quad over that rect alone. A group that owns a surface of its own draws it, effects
 * and all, into the retained one. Inside a group's effects buffer it composites
 * into that buffer instead, at the same offset.
 *
 * On the default framebuffer, a group whose pixels move with its transform
 * (`movesWithView`) may be composited from a surface drawn before a pan,
 * moved; `RetainedSurfaces.lookup` decides when.
 */
export function drawRetainedGroup(
  ctx: DrawContext, cmd: GroupDrawCommand, ownsSurface: boolean, dispatch: Dispatch,
): boolean {
  const store = ctx.retained;
  const width = ctx.deviceWidth;
  const height = ctx.deviceHeight;
  if (!store || !width || !height) return false;
  const inScratch = ctx.renderTarget != null && scratchTargets.has(ctx.renderTarget);
  if (inScratch || isOwnComposite(cmd.composite) || readsBackdrop(cmd.children)) {
    store.decline();
    return false;
  }
  const id = cmd.retain!;

  ctx.state.push({ transform: cmd.transform, alpha: cmd.alpha, colorMatrix: cmd.colorMatrix });
  const clips: RetainedClip[] = ctx.clipStack.map(({ path, transform }) => ({ path, transform }));
  if (cmd.clip) clips.push({ path: cmd.clip, transform: ctx.state.transform });
  const key: RetainedKey = {
    children: cmd.children,
    transform: ctx.state.transform,
    alpha: ctx.state.alpha,
    colorMatrix: ctx.state.colorMatrix,
    viewMatrix: ctx.viewMatrix,
    screenMatrix: ctx.screenMatrix,
    clips,
    effects: cmd.effects,
    isolate: cmd.isolate === true,
    window: ctx.renderTarget?.window,
  };
  // A buffer a group's effects draw in is single-sampled, and so is a
  // surface standing in for drawing into it.
  const multisample = !ctx.renderTarget;
  // A group that owns a surface draws it inside this one, under the stack
  // and clips just pushed: its own buffer composites with what it owes.
  const drawn = ownsSurface ? [{ kind: 'group' as const, effects: cmd.effects, isolate: cmd.isolate, children: cmd.children }] : cmd.children;
  const scale = width / ctx.widthCss;
  const pans = multisample && movesWithView(drawn, ctx.viewMatrix !== undefined);
  const found = store.lookup(id, width, height, key, multisample, pans ? scale : undefined);
  let pixels: RetainedPixels;
  if (found.kind === 'through') {
    ctx.state.pop();
    return false;
  }
  if (found.kind === 'kept') {
    pixels = found.pixels;
  } else {
    // Inside an effects buffer, what it holds, which may reach past the
    // drawing buffer: a blur there reads what lies just past the edge.
    const window = key.window ?? found.window;
    const box = contentBox(drawn, ctx.state.transform, clips, scale);
    const draw = store.reserve(id, width, height, boxWithin(box, window), multisample, pans ? { box, window } : undefined);
    if (!draw) {
      ctx.state.pop();
      return false;
    }
    // Staged geometry belongs to the buffer underneath.
    flushBatch(ctx);
    if (draw.target) drawInto(ctx, drawn, clips, draw.target, draw, dispatch);
    pixels = draw.commit(key);
  }
  ctx.state.pop();

  const { texture, rect } = pixels;
  if (!texture) return true;
  flushBatch(ctx);
  const composite = ctx.ensureProgram?.(compositeProgramId()) ?? null;
  // The clips were drawn inside: the composite tests none.
  if (composite) compositeOver(ctx, composite, texture, rect, COMPOSITE_AS_DRAWN);
  return true;
}

/** Draw `children` into `draw.rect` of the surface, a tile at a time: each
 *  into the bottom-left of the scratch buffer `scratch`, under the group stack
 *  as it stands and inside `clips`, then resolved into its place. A command
 *  whose bounds miss a tile, at any depth, is not dispatched for it. */
function drawInto(
  ctx: DrawContext, children: readonly DrawCommand[], clips: readonly RetainedClip[],
  scratch: GpuTarget, draw: RetainedDraw, dispatch: Dispatch,
): void {
  const gpu = ctx.gpu;
  const width = ctx.deviceWidth!;
  const height = ctx.deviceHeight!;
  const { tiles } = draw;
  const parentTarget = ctx.renderTarget ?? null;
  const parentClipDepth = ctx.clipDepth;
  const parentClipStack = ctx.clipStack;
  const parentBatchClip = ctx.drawBatch.clip;
  const parentProjection = ctx.projection;
  const scale = width / ctx.widthCss;
  const tree = tiles.length > 1 ? boxTree(children, ctx.state.transform, scale) : null;

  gpu.endPass();
  for (const tile of tiles) {
    const bottom = tile.y + tile.height;
    // Every tile's projection is the canvas's moved to the tile's corner,
    // which lands on the scratch buffer's: the pixels are the ones drawing
    // the surface whole leaves.
    ctx.projection = windowProjection(tile, scale);
    const corner = { x: 0, y: 0, width: tile.width, height: tile.height };
    const pass = { target: scratch, viewport: corner, scissor: corner };
    const target = { pass, fragOrigin: [-tile.x, bottom - height] as const, window: tile };
    scratchTargets.add(target);
    ctx.renderTarget = target;
    ctx.clipDepth = 0;
    ctx.clipStack = [];
    ctx.drawBatch.clip = null;

    gpu.beginPass({ ...pass, clear: { color: true, stencil: true } });
    for (const clip of clips) enterGroupClip(ctx, clip.path, clip.transform);
    for (const child of tree ? cullToTile(tree, tile) : children) dispatch(ctx, child);
    flushBatch(ctx);
    gpu.endPass();
    draw.resolve(tile);
  }

  ctx.clipDepth = parentClipDepth;
  ctx.clipStack = parentClipStack;
  ctx.drawBatch.clip = parentBatchClip;
  ctx.projection = parentProjection;
  ctx.renderTarget = parentTarget;
  const resume = parentTarget ? parentTarget.pass : ctx.canvasPass;
  if (resume) gpu.beginPass(resume);
}
