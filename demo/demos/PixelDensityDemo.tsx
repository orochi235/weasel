import { useEffect, useRef } from 'react';
import { setupCanvasDpr, useFixedPixelRatio } from '@orochi235/weasel';

const W = 200;
const H = 100;

// A tiny 8-color palette and an 8x8 sprite expressed as palette indices.
const PALETTE = [
  '#1a1a2e', '#16213e', '#0f3460', '#e94560',
  '#f5b7a3', '#ffd166', '#06d6a0', '#ffffff',
];
const SPRITE = [
  '00007700',
  '00077770',
  '00777707',
  '07770070',
  '77700700',
  '77007000',
  '70070000',
  '00700000',
].map((row) => row.split('').map((c) => Number.parseInt(c, 10)));

function paintSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number) {
  for (let y = 0; y < SPRITE.length; y++) {
    for (let x = 0; x < SPRITE[y].length; x++) {
      const i = SPRITE[y][x];
      if (i === 0) continue;
      ctx.fillStyle = PALETTE[i];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

export function PixelDensityDemo() {
  const fixedRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef<HTMLCanvasElement | null>(null);
  const fixedDpr = useFixedPixelRatio();

  useEffect(() => {
    const fixed = fixedRef.current;
    const native = dprRef.current;
    if (!fixed || !native) return;

    const fctx = fixed.getContext('2d')!;
    setupCanvasDpr(fixed, fctx, W, H, { dpr: fixedDpr });
    fctx.imageSmoothingEnabled = false;
    fctx.fillStyle = '#1a1a2e';
    fctx.fillRect(0, 0, W, H);
    paintSprite(fctx, 20, 18, 8);

    const nctx = native.getContext('2d')!;
    setupCanvasDpr(native, nctx, W, H);
    nctx.imageSmoothingEnabled = false;
    nctx.fillStyle = '#1a1a2e';
    nctx.fillRect(0, 0, W, H);
    paintSprite(nctx, 20, 18, 8);
  }, [fixedDpr]);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <canvas ref={fixedRef} className="ckd-canvas" />
        <small style={{ opacity: 0.7 }}>useFixedPixelRatio()</small>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <canvas ref={dprRef} className="ckd-canvas" />
        <small style={{ opacity: 0.7 }}>default (devicePixelRatio)</small>
      </div>
    </div>
  );
}

export const PIXEL_DENSITY_DEMO_SOURCE = `// useFixedPixelRatio returns 1 — opt out of DPR scaling so the canvas
// backing store matches CSS pixels exactly. Useful for putImageData,
// hairline alignment, and pixel-art rendering where each "world pixel"
// must land on exactly one backing pixel.

const fixedDpr = useFixedPixelRatio();

useEffect(() => {
  const ctx = canvas.getContext('2d')!;
  setupCanvasDpr(canvas, ctx, W, H, { dpr: fixedDpr });
  ctx.imageSmoothingEnabled = false;
  paintSprite(ctx, ox, oy, scale);
}, [fixedDpr]);

// Compare with the default — when devicePixelRatio > 1, the backing
// store is 2x (or 3x) the CSS size, and a 1px-wide rect occupies
// 2 (or 3) backing pixels. Most demos want this; pixel art doesn't.`;
