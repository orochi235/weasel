/**
 * A label's draw commands as a P-touch `.lbx` file.
 */
import type { CommandRasterizer, RasterImage } from '@weasel-js/core';
import { mat3, type GlMat3 } from '@weasel-js/geom';
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
import { lineObject, rectObject, textObject } from './shapes';
import type { DrawState } from './style';

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

function plainGroup(g: GroupDrawCommand): boolean {
  const composite = g.composite ?? 'source-over';
  return !g.clip && !g.effects?.length && !g.isolate && !g.colorMatrix && composite === 'source-over';
}

/** `cmd` under `state`, as a command drawn in the page's frame. */
function placed(cmd: DrawCommand, state: DrawState): DrawCommand {
  return { kind: 'group', transform: state.transform, alpha: state.alpha, children: [cmd] };
}

function collect(commands: readonly DrawCommand[], state: DrawState, out: Item[]): void {
  for (const cmd of commands) {
    if (cmd.kind === 'group' && plainGroup(cmd)) {
      const transform = cmd.transform ? mat3.multiply(Float64Array.from(state.transform), cmd.transform) : state.transform;
      collect(cmd.children, { transform, alpha: state.alpha * (cmd.alpha ?? 1) }, out);
      continue;
    }
    const mapped =
      cmd.kind === 'path' ? (rectObject(cmd, state) ?? lineObject(cmd, state)) :
      cmd.kind === 'text' ? textObject(cmd, state) :
      undefined;
    if (mapped === undefined) out.push({ raster: placed(cmd, state) });
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
  const items: Item[] = [];
  collect(page.commands, { transform: mat3.identity(), alpha: 1 }, items);
  const skipped: LbxSkip[] = [];
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
    ...(cuts.length > 0 ? { cut: { freeCut: [...cuts].sort((a, b) => a - b) } } : {}),
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
