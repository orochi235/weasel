import { defineInstrument, f, Lab, noneAdapter, type ViewTransform } from '@weasel-js/labkit';
// In-repo, so the source stylesheet: a consumer imports the built
// `@weasel-js/labkit/styles.css` instead.
import '@weasel-js/labkit/styles.less';
import 'windease/styles.css';

const RAMP = ['#e5484d', '#f5a524', '#46a758', '#0091ff', '#8e4ec6'];

/** Fine enough that the difference between magnifying and not is obvious: a
 *  1px grid, a run of single-pixel rules, and a ramp of swatches. */
function drawDetail(ctx: CanvasRenderingContext2D, zoom: number): void {
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(0, 0, 800, 600);

  ctx.strokeStyle = '#c9ccd4';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = 0; x <= 800; x += 20) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 600);
  }
  for (let y = 0; y <= 600; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
  }
  ctx.stroke();

  // Alternating one-world-pixel rules: illegible at 1:1, and the sharpest test
  // of what a lens does to a hard edge.
  ctx.fillStyle = '#1f2430';
  for (let i = 0; i < 40; i++) ctx.fillRect(80 + i * 2, 90, 1, 70);

  RAMP.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(80 + i * 36, 200, 30, 30);
  });

  ctx.fillStyle = '#1f2430';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('eleven pixel type, legible only under the lens', 80, 280);
}

const drawn = defineInstrument({
  name: 'Drawn detail',
  config: f.schema({
    mode: f
      .enum('vector', ['vector', 'pixel'])
      .label('Lens')
      .describe('vector re-draws the layers magnified; pixel enlarges what was presented'),
  }),
  initialState: () => ({}),
  render: () => null,
  canvas: {
    initialView: { zoom: 1, pan: { x: 24, y: 24 } },
    layers: [{ id: 'detail', draw: (ctx, { zoom }) => drawDetail(ctx, zoom) }],
  },
  layers: { ids: [{ id: 'detail', label: 'Detail' }] },
  // Read per trial, so the Lens setting reaches the lens without the demo
  // owning any loupe state of its own.
  loupe: (config) => ({ mode: config.mode }),
});

interface CardProps {
  view: ViewTransform;
  lines: number;
}

/** The whole DOM instrument, and the whole of what its lens draws. Rendering
 *  the same component through the camera the lens hands over is the DOM
 *  painter's entire contract. */
function Card({ view, lines }: CardProps) {
  const style = {
    transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
  };
  return (
    <div className="lab-loupe-stage" style={style}>
      {Array.from({ length: lines }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length ruler, no identity
        <p key={i} className="lab-loupe-line">
          <span className="lab-loupe-num">{String(i).padStart(3, '0')}</span>
          the quick brown fox jumps over the lazy dog — 0123456789
        </p>
      ))}
    </div>
  );
}

const IDENTITY: ViewTransform = { zoom: 1, pan: { x: 0, y: 0 } };

const written = defineInstrument({
  name: 'Written detail',
  config: f.schema({ lines: f.number(20).range(4, 60).slider().label('Lines') }),
  initialState: () => ({}),
  render: ({ config }) => <Card view={IDENTITY} lines={config.lines} />,
  loupe: {
    diameter: 220,
    render: ({ config, view }) => <Card view={view} lines={(config as { lines: number }).lines} />,
  },
});

export function LabLoupeDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab
        title="Loupe"
        instruments={[drawn, written]}
        defaultInstrument="Drawn detail"
        storage={noneAdapter}
      />
    </div>
  );
}
