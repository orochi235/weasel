import { useSyncExternalStore } from 'react';
import { SceneCanvas, asNodeId, solid, useScene, textEditPreset } from '@weasel-js/core';
import type { Fill } from '@weasel-js/core';
import { glyphGeneration, subscribeGlyphReady } from '@weasel-js/font';
import { DEFAULT_TEXT_STYLE, smallCapsScaleFor } from '@weasel-js/text';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import { DemoStage } from './DemoStage';

const W = 520;
const H = 230;

interface NodeData { text: string; runs?: StyledRun[]; style: TextStyle; fill: Fill }

const INK = solid('#1c1c1c');

const leaf = (id: string, y: number, fontSize: number, data: Omit<NodeData, 'fill' | 'style'> & { style?: TextStyle }) => ({
  kind: 'mark' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: { x: 20, y, width: W - 40, height: fontSize * 1.4 },
  data: { fill: { paint: INK }, ...data, style: { fontSize, ...data.style } },
});

const NODES = [
  // The node style sets it, so every run inherits it.
  leaf('node', 16, 34, { text: 'Small caps from the node', style: { fontVariantCaps: 'small-caps' } }),
  // One run sets it, the way an acronym or a time of day is set inline.
  leaf('runs', 74, 24, {
    text: 'Launched by nasa at 9:30 am.',
    runs: [
      { text: 'Launched by ' },
      { text: 'nasa', fontVariantCaps: 'small-caps' },
      { text: ' at 9:30 ' },
      { text: 'am', fontVariantCaps: 'small-caps' },
      { text: '.' },
    ],
  }),
  // It reads the text after `textTransform`: capitalize raises each first
  // letter to a full capital, and small caps sets the rest.
  leaf('transform', 124, 28, {
    text: 'chapter one: the beginning',
    style: { fontVariantCaps: 'small-caps', textTransform: 'capitalize' },
  }),
  leaf('plain', 176, 28, { text: 'The same line without it' }),
];

export function SmallCapsDemo() {
  // The scale is the face's own heights once its atlas has loaded.
  useSyncExternalStore(subscribeGlyphReady, glyphGeneration);
  const scale = smallCapsScaleFor(DEFAULT_TEXT_STYLE.fontFamily, 400, 'normal');
  const scene = useScene<NodeData, 'default'>({ systemLayers: [{ id: 'default' }], initial: NODES });

  return (
    <div className="ckd-demo">
      <p className="ckd-hint">
        Small capitals are set at {(scale * 100).toFixed(1)}% — the face&apos;s x-height over its
        cap height, from its <code>OS/2</code> table.
      </p>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          selectable={false}
          features={[textEditPreset]}
        />
      </DemoStage>
    </div>
  );
}
