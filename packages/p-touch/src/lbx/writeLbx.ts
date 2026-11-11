/**
 * A label's draw commands as a P-touch `.lbx` file.
 */
import type { CommandRasterizer, RasterImage } from '@weasel-js/core';
import { mat3, type GlMat3, type Path } from '@weasel-js/geom';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import {
  AUTO_LENGTH_MAX_PT,
  backgroundFor,
  buildLbx,
  encodeBmp32,
  type ImageObject,
  type LabelConfig,
  type LabelObject,
} from 'bil-lbx';
import type { Tape } from '../tape';
import { carriedObjects, placeCarried } from './carried';
import { lineObject, rectObject, textObject } from './shapes';
import { axisMap, type DrawState } from './style';

/** One label: its size and the commands painted on it, in points with the origin at its top left. */
export interface LbxPage {
  /** Length along the tape, in points. */
  length: number;
  tape: Tape;
  commands: readonly DrawCommand[];
  /** What a `world`-unit paint in `commands` resolves through, as `PdfPage.view`. */
  view?: GlMat3;
  /** Let P-touch size the label to what is on it. `length` is still written as the fitted length. */
  autoLength?: boolean;
  /** Where the printer cuts, in points along the label: a strip of labels in one file. */
  cuts?: readonly number[];
}

/** Settings and the host callback for {@link writeLbx}. */
export interface WriteLbxOptions {
  /** Draws what an `.lbx` object cannot state; `commandRasterizer` from `@weasel-js/core` is one. Without it those commands are skipped. */
  rasterize?: CommandRasterizer;
  /** Pixels per inch for rasterized content. Default 180, the PT-P710BT's. */
  rasterDpi?: number;
}

/** A command the writer left out of the file, with the reason. */
export interface LbxSkip {
  kind: DrawCommand['kind'];
  detail: string;
}

/** The finished file, the label it describes, and what it had to leave out. */
export interface LbxResult {
  bytes: Uint8Array;
  config: LabelConfig;
  skipped: readonly LbxSkip[];
}

type Item = { object: LabelObject } | { raster: DrawCommand };

/** A clip above the commands being walked, with the transform it is drawn under. */
interface Clip {
  path: Path;
  transform: GlMat3;
}

/** A group whose children cannot be drawn one at a time: an effect, isolate, color matrix or blend. */
function rasterWhole(g: GroupDrawCommand): boolean {
  return !!g.effects?.length || !!g.isolate || !!g.colorMatrix || (g.composite ?? 'source-over') !== 'source-over';
}

function hasCarrier(commands: readonly DrawCommand[]): boolean {
  return commands.some((c) => carriedObjects(c) !== undefined || (c.kind === 'group' && hasCarrier(c.children)));
}

function countCarriers(commands: readonly DrawCommand[]): number {
  let n = 0;
  for (const c of commands) n += carriedObjects(c) ? 1 : c.kind === 'group' ? countCarriers(c.children) : 0;
  return n;
}

/** `cmd` under `state` and `clips`, as a command drawn in the page's frame; undefined when a collapsed clip hides it. */
function placed(cmd: DrawCommand, state: DrawState, clips: readonly Clip[]): DrawCommand | undefined {
  let out: GroupDrawCommand = { kind: 'group', transform: state.transform, alpha: state.alpha, children: [cmd] };
  for (let i = clips.length - 1; i >= 0; i--) {
    const { path, transform } = clips[i]!;
    const inverse = mat3.invert(transform);
    if (!inverse) return undefined;
    out = { kind: 'group', transform, clip: path, children: [{ ...out, transform: mat3.multiply(inverse, out.transform!) }] };
  }
  return out;
}

const CLIP_EPS = 1e-6;

/** Whether every object, in the page's frame, lies inside every clip, each an axis-aligned rect. */
function insideClips(objects: readonly LabelObject[], clips: readonly Clip[]): boolean {
  return clips.every(({ path, transform }) => {
    const map = path.kind === 'rect' ? axisMap(transform) : undefined;
    if (!map || path.kind !== 'rect') return false;
    const x0 = Math.min(path.x, path.x + path.width) * map.sx + map.tx;
    const y0 = Math.min(path.y, path.y + path.height) * map.sy + map.ty;
    const x1 = x0 + Math.abs(path.width) * map.sx, y1 = y0 + Math.abs(path.height) * map.sy;
    return objects.every(({ position: p }) =>
      p.x >= x0 - CLIP_EPS && p.y >= y0 - CLIP_EPS && p.x + p.width <= x1 + CLIP_EPS && p.y + p.height <= y1 + CLIP_EPS);
  });
}

/** Whether every number an object holds is finite: what a file can say and P-touch can place. */
function finiteObject(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object' || ArrayBuffer.isView(v)) return true;
  return Object.values(v).every(finiteObject);
}

function collect(commands: readonly DrawCommand[], state: DrawState, clips: readonly Clip[], out: Item[], skipped: LbxSkip[]): void {
  const raster = (cmd: DrawCommand) => {
    const at = placed(cmd, state, clips);
    if (at) out.push({ raster: at });
  };
  for (const cmd of commands) {
    const carried = carriedObjects(cmd);
    if (carried) {
      const placed = placeCarried(carried, state);
      if (typeof placed === 'string') skipped.push({ kind: 'group', detail: placed });
      else if (!placed.every(finiteObject)) skipped.push({ kind: 'group', detail: 'lbxObjects placed at a position no number can say' });
      else if (placed.length > 0 && !insideClips(placed, clips)) {
        skipped.push({ kind: 'group', detail: 'lbxObjects not wholly inside an axis-aligned rect clip' });
      } else for (const object of placed) out.push({ object });
      continue;
    }
    if (cmd.kind === 'group' && rasterWhole(cmd)) {
      raster(cmd);
      for (let n = countCarriers(cmd.children); n > 0; n--) {
        skipped.push({ kind: 'group', detail: 'lbxObjects under a group effect, isolate, color matrix or blend' });
      }
      continue;
    }
    // Under a clip only the carriers can be objects, so a subtree without one stays whole.
    const clipped = clips.length > 0 || (cmd.kind === 'group' && !!cmd.clip);
    if (clipped && !(cmd.kind === 'group' && hasCarrier(cmd.children))) {
      raster(cmd);
      continue;
    }
    if (cmd.kind === 'group') {
      // Without an isolate, a clipped group's children paint one by one, so each carries the clip on its own.
      const transform = cmd.transform ? mat3.multiply(state.transform, cmd.transform) : state.transform;
      const inner = cmd.clip ? [...clips, { path: cmd.clip, transform }] : clips;
      collect(cmd.children, { transform, alpha: state.alpha * (cmd.alpha ?? 1) }, inner, out, skipped);
      continue;
    }
    const mapped =
      cmd.kind === 'path' ? (rectObject(cmd, state) ?? lineObject(cmd, state)) :
      cmd.kind === 'text' ? textObject(cmd, state) :
      undefined;
    // A position past the double range, under a scale or a stroke that overflows it, is the rasterizer's to draw.
    if (mapped === undefined || !(Array.isArray(mapped) ? mapped : [mapped]).every(finiteObject)) raster(cmd);
    else for (const object of Array.isArray(mapped) ? mapped : [mapped]) out.push({ object });
  }
}

/** The smallest box holding every pixel with any alpha, or undefined when none has. */
function inkBounds(img: RasterImage): { x: number; y: number; width: number; height: number } | undefined {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? undefined : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function crop(img: RasterImage, box: { x: number; y: number; width: number; height: number }): Uint8ClampedArray {
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y + y) * img.width + box.x) * 4;
    out.set(img.data.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return out;
}

async function rasterObject(
  commands: DrawCommand[],
  page: LbxPage,
  rasterize: CommandRasterizer,
  dpi: number,
): Promise<ImageObject | undefined> {
  const scale = dpi / 72;
  const img = await rasterize(commands, { x: 0, y: 0, width: page.length, height: page.tape.widthPt }, scale, page.view);
  const box = inkBounds(img);
  if (!box) return undefined;
  return {
    type: 'image',
    position: { x: box.x / scale, y: box.y / scale, width: box.width / scale, height: box.height / scale },
    imageData: encodeBmp32(crop(img, box), box.width, box.height),
  };
}

/** Each run of commands an object cannot state, drawn as one image, in paint order with the objects around it. */
async function settle(items: Item[], page: LbxPage, opts: WriteLbxOptions, skipped: LbxSkip[]): Promise<LabelObject[]> {
  const objects: LabelObject[] = [];
  let run: DrawCommand[] = [];
  const flush = async () => {
    if (run.length === 0) return;
    if (opts.rasterize) {
      const image = await rasterObject(run, page, opts.rasterize, opts.rasterDpi ?? 180);
      if (image) objects.push(image);
    } else {
      for (const cmd of run) skipped.push({ kind: innermost(cmd).kind, detail: 'no rasterize hook for what .lbx cannot draw' });
    }
    run = [];
  };
  for (const item of items) {
    if ('raster' in item) run.push(item.raster);
    else {
      await flush();
      objects.push(item.object);
    }
  }
  await flush();
  return objects;
}

function innermost(cmd: DrawCommand): DrawCommand {
  return cmd.kind === 'group' && cmd.children.length === 1 ? innermost(cmd.children[0]!) : cmd;
}

/** The `.lbx` label `page` describes, without the file: its paper, cuts and objects. */
export async function lbxConfig(page: LbxPage, opts: WriteLbxOptions = {}): Promise<{ config: LabelConfig; skipped: LbxSkip[] }> {
  if (!Number.isFinite(page.length) || page.length <= 0) {
    throw new RangeError(`writeLbx: a label's length must be a positive finite number of points, got ${page.length}`);
  }
  const items: Item[] = [];
  const skipped: LbxSkip[] = [];
  collect(page.commands, { transform: mat3.identity(), alpha: 1 }, [], items, skipped);
  const objects = await settle(items, page, opts, skipped);
  const paper = {
    width: page.tape.widthPt,
    format: page.tape.format,
    autoLength: page.autoLength ?? false,
    // Under auto length P-touch parks its 1000mm ceiling here; the length lives in the background band.
    height: page.autoLength ? AUTO_LENGTH_MAX_PT : page.length,
  };
  const cuts = page.cuts?.filter((x) => x > 0 && x < page.length) ?? [];
  const config: LabelConfig = {
    paper,
    background: backgroundFor(paper, page.length),
    objects,
    ...(cuts.length > 0 ? { cut: { freeCut: [...new Set(cuts)].sort((a, b) => a - b) } } : {}),
  };
  return { config, skipped };
}

/**
 * Write `page` as an `.lbx` file. Axis-aligned rects, open polylines and plain text boxes become
 * objects P-touch Editor can edit; everything else is drawn through `rasterize` and placed as an
 * image at `rasterDpi`. Objects keep the commands' paint order.
 */
export async function writeLbx(page: LbxPage, opts: WriteLbxOptions = {}): Promise<LbxResult> {
  const { config, skipped } = await lbxConfig(page, opts);
  return { bytes: await buildLbx(config), config, skipped };
}
