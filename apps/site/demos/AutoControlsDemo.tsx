import { auto, defineInstrument, f, Lab } from '@weasel-js/labkit';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
];

const grid = defineInstrument({
  name: 'Grid',
  config: f.schema({
    // The driver the other two resolve from, and never auto for the same reason
    // `tint` is: every line below divides by it, so there is no picture to draw
    // without one.
    width: f.number(640).range(240, 900).step(10).suffix('px').label('Width'),

    // The two fields the width drives. Auto until someone pins them, and what
    // the resolver returns is what the ghosted slider draws.
    cols: f
      .number(6)
      .range(1, 16)
      .auto((c) => clamp((c.width as number) / 110, 1, 16))
      .initial(auto)
      .label('Columns'),
    gap: f
      .number(12)
      .range(0, 48)
      .suffix('px')
      .auto((c) => clamp((c.width as number) / 60, 0, 48))
      .initial(auto)
      .label('Gap'),

    // Reads `cols`, which is usually auto itself — resolution is demand-driven,
    // so the column count resolves first and the caption counts what was drawn
    // rather than a number that was true when someone typed it.
    caption: f
      .string('six across')
      .auto((c) => `${WORDS[c.cols as number] ?? String(c.cols)} across`)
      .initial(auto)
      .placeholder('caption…')
      .label('Caption'),

    // Straight into a fill, which cannot take `undefined` — so it never says
    // `.auto()` and takes no pin dot.
    tint: f.color('#8e4ec6').label('Tint'),
  }),
  initialState: () => ({}),
  render: () => null,
  canvas: {
    initialView: { zoom: 1, pan: { x: 40, y: 40 } },
    layers: [
      {
        id: 'grid',
        draw: (ctx, { config }) => {
          const { width, cols, gap, caption, tint } = config as {
            width: number;
            cols: number;
            gap: number;
            caption?: string;
            tint: string;
          };
          const cell = (width - gap * (cols - 1)) / cols;
          ctx.fillStyle = '#f4f4f5';
          ctx.fillRect(0, 0, width, 260);
          ctx.fillStyle = tint;
          for (let i = 0; i < cols; i++) {
            ctx.fillRect(i * (cell + gap), 0, Math.max(cell, 1), 180);
          }
          if (caption) {
            ctx.fillStyle = '#1f2430';
            ctx.font = '14px system-ui, sans-serif';
            ctx.fillText(caption, 0, 212);
          }
        },
      },
    ],
  },
  layers: { ids: [{ id: 'grid', label: 'Grid' }] },
});

export function AutoControlsDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Auto controls" instruments={[grid]} defaultInstrument="Grid" />
    </div>
  );
}
