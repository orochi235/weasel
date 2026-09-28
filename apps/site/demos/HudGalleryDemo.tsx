import { useEffect } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import type { Hud } from '@weasel-js/hud';

const W = 640, H = 264;
const COL = [24, 232, 440], ROW = [24, 144];
const CELL_W = 176, CELL_H = 96;

interface Empty { id: string }

// A 5×5 "F": asymmetric on both axes, so a flip is visible at a glance.
const SPRITE = [
  '#####',
  '#....',
  '####.',
  '#....',
  '#....',
];

function spriteBitmap(): Promise<ImageBitmap> {
  const px = new Uint8ClampedArray(25 * 4);
  SPRITE.join('').split('').forEach((c, i) => {
    px.set(c === '#' ? [224, 96, 48, 255] : [255, 236, 200, 255], i * 4);
  });
  return createImageBitmap(new ImageData(px, 5, 5));
}

/** A backdrop rect and a caption label for one gallery cell. */
function cell(hud: Hud, col: number, row: number, caption: string) {
  const x = COL[col], y = ROW[row];
  return [
    hud.rect({ id: `cell-${col}-${row}`, x, y, w: CELL_W, h: CELL_H, fill: 'rgba(128, 128, 128, 0.14)' }),
    hud.label({ id: `caption-${col}-${row}`, x: x + 10, y: y + CELL_H - 20, text: caption }),
  ];
}

export function HudGalleryDemo() {
  const hud = useHud();
  const hudEntry = useHudContribution(hud, { font: 'sans-serif' });
  const scene = useScene<Empty>({ items: [] });

  useEffect(() => {
    let canceled = false;
    const widgets: { dispose(): void }[] = [
      ...cell(hud, 0, 0, 'rect · fill'),
      hud.rect({ id: 'swatch', x: COL[0] + 10, y: ROW[0] + 10, w: 72, h: 44, fill: '#3b82f6' }),
      hud.rect({ id: 'swatch-2', x: COL[0] + 90, y: ROW[0] + 10, w: 72, h: 44, fill: 'hsl(150 60% 45%)' }),

      ...cell(hud, 1, 0, 'text · fontSize, color'),
      hud.text({ id: 'text', x: COL[1] + 10, y: ROW[0] + 12, text: 'Aa 28px', fontSize: 28, color: '#e0603a' }),

      ...cell(hud, 2, 0, 'label · theme defaults'),
      hud.label({ id: 'label', x: COL[2] + 10, y: ROW[0] + 16, text: 'A label: 13px, --wzl-fg' }),

      ...cell(hud, 0, 1, "image · 'nearest', source"),
      ...cell(hud, 1, 1, "image · 'linear', flipX"),
      ...cell(hud, 2, 1, 'button · press to flip'),
    ];

    spriteBitmap().then((bitmap) => {
      if (canceled) return;
      const size = { y: ROW[1] + 8, w: 56, h: 56 };
      const nearest = hud.image({ id: 'nearest', x: COL[0] + 10, ...size, image: bitmap, sampling: 'nearest' });
      const linear = hud.image({ id: 'linear', x: COL[1] + 10, ...size, image: bitmap, sampling: 'linear', flipX: true });
      const top = hud.image({ id: 'source', x: COL[0] + 76, ...size, h: 22, image: bitmap, sampling: 'nearest', source: { x: 0, y: 0, w: 5, h: 2 } });

      let flipX = true;
      const flip = hud.button({ id: 'flip', x: COL[2] + 10, y: ROW[1] + 16, w: 120, h: 34, label: 'Flip the F' });
      flip.on('press', () => linear.setFlip({ x: (flipX = !flipX) }));
      widgets.push(nearest, linear, top, flip);
    });

    return () => {
      canceled = true;
      for (const w of widgets) w.dispose();
    };
  }, [hud]);

  return (
    <div className="ckd-canvas-wrap">
      <SceneCanvas features={['pick']}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        ambient={[hudEntry]}
      />
    </div>
  );
}
