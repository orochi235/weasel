/** Bitmap pixels per preview unit, so a slot stays sharp on a 2× display. */
const DENSITY = 2;

/** A moment of the demo pipeline's run, as its pictures need it. */
export interface Moment {
  t: number;
  /** Whether the quality check sent the picture through the blur. */
  high: boolean;
}

/** The oscillator's value at `t` seconds: the blur radius, in preview units. */
export const radiusAt = (t: number): number => 6 + 4 * Math.sin(t * 2);

type Ctx = OffscreenCanvasRenderingContext2D;
/** Draws one slot's picture, reading the pictures wired into it through `take`. */
type Painter = (ctx: Ctx, m: Moment, take: (slot: string) => OffscreenCanvas, spare: (name: string) => OffscreenCanvas) => void;

/** A moving light over sharp stripes, so the blur has something to soften. */
const source: Painter = (ctx, m) => {
  const { width: w, height: h } = ctx.canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, 'hsl(205 55% 34%)');
  sky.addColorStop(1, 'hsl(190 40% 10%)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4e9c8';
  ctx.beginPath();
  ctx.arc(((m.t * 24) % (w + 24)) - 12, h * 0.42, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'hsl(30 35% 45%)';
  for (let x = 0; x < w; x += 8 * DENSITY) ctx.fillRect(x, h * 0.72, 4 * DENSITY, h * 0.28);
};

const copy = (slot: string): Painter => (ctx, _m, take) => ctx.drawImage(take(slot), 0, 0);

/** The last two seconds of the radius, drawn as a scope trace. */
const oscillator: Painter = (ctx, m) => {
  const { width: w, height: h } = ctx.canvas;
  const y = (t: number) => h * (0.9 - ((radiusAt(t) - 2) / 8) * 0.8);
  ctx.fillStyle = '#0c1419';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'hsl(140 60% 55%)';
  ctx.lineWidth = DENSITY;
  ctx.beginPath();
  for (let x = 0; x <= w; x += DENSITY) ctx.lineTo(x, y(m.t - ((w - x) / w) * 2));
  ctx.stroke();
  ctx.fillStyle = 'hsl(140 80% 75%)';
  ctx.beginPath();
  ctx.arc(w - 2 * DENSITY, y(m.t), 2 * DENSITY, 0, Math.PI * 2);
  ctx.fill();
};

/** The source shrunk by the radius and stretched back: a blur every canvas can draw. */
const blur: Painter = (ctx, m, take, spare) => {
  const { width: w, height: h } = ctx.canvas;
  const k = 1 + radiusAt(m.t) * 0.8;
  const small = spare('blur');
  const sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k));
  const s = small.getContext('2d')!;
  s.clearRect(0, 0, small.width, small.height);
  s.imageSmoothingQuality = 'high';
  s.drawImage(take('q/yes'), 0, 0, sw, sh);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, sw, sh, 0, 0, w, h);
};

/** Rays turning from above the top-left corner, on black so a screen blend leaves the rest alone. */
const beams: Painter = (ctx, m) => {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w * 0.15, -h * 0.3);
  ctx.rotate(m.t * 0.3);
  const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.2);
  fade.addColorStop(0, 'hsl(42 95% 70%)');
  fade.addColorStop(1, 'hsl(42 95% 70% / 0)');
  ctx.fillStyle = fade;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, w * 1.5, a - 0.09, a + 0.09);
    ctx.fill();
  }
};

/** A circle, opaque inside and clear outside. */
const mask: Painter = (ctx) => {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.4, 0, Math.PI * 2);
  ctx.fill();
};

/** The base, with the beams cut to the mask and screened over it. */
const composite: Painter = (ctx, m, take, spare) => {
  const { width: w, height: h } = ctx.canvas;
  const layer = spare('mix');
  const l = layer.getContext('2d')!;
  l.globalCompositeOperation = 'copy';
  l.drawImage(take('beams/out'), 0, 0);
  l.globalCompositeOperation = 'destination-in';
  l.drawImage(take('cutout/out'), 0, 0);
  ctx.drawImage(take(m.high ? 'blur/out' : 'q/no'), 0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(layer, 0, 0);
};

/** Each preview slot, `stage/port`, and how its picture is made. */
export const PAINTERS: Readonly<Record<string, Painter>> = {
  'src/out': source,
  'q/yes': copy('src/out'),
  'q/no': copy('src/out'),
  'osc/value': oscillator,
  'blur/out': blur,
  'beams/out': beams,
  'cutout/out': mask,
  'mix/out': composite,
  'out/in': copy('mix/out'),
};

/** Draw `slots` at `m`, each at most once and after whatever it reads, and hand them over as bitmaps.
 *  `canvases` holds one canvas per slot or spare from frame to frame. */
export function paint(canvases: Map<string, OffscreenCanvas>, size: { width: number; height: number }, slots: readonly string[], m: Moment): Map<string, ImageBitmap> {
  const canvas = (key: string) => {
    let c = canvases.get(key);
    if (c === undefined) canvases.set(key, c = new OffscreenCanvas(size.width * DENSITY, size.height * DENSITY));
    return c;
  };
  const drawn = new Set<string>();
  const take = (slot: string): OffscreenCanvas => {
    const c = canvas(slot);
    if (drawn.has(slot)) return c;
    drawn.add(slot);
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, c.width, c.height);
    PAINTERS[slot]!(ctx, m, take, (name) => canvas(`spare:${name}`));
    ctx.restore();
    return c;
  };
  for (const slot of slots) take(slot);
  return new Map(slots.map((slot) => [slot, canvas(slot).transferToImageBitmap()]));
}
